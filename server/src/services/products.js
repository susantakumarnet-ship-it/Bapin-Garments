import { query, one } from '../db/index.js';
import { getLowStockThreshold } from './settings.js';
import { productStockCte, stockStatus, stockStatusSql } from './inventory.js';
import { Where, pageParams, toInt } from '../utils/helpers.js';

export const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Free Size'];
export const sizeRank = (s) => {
  const i = SIZE_ORDER.indexOf(s);
  if (i >= 0) return i;
  // Baby sizes (0-6M), then kids (2-3Y), then waist sizes (28, 30 ...).
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 900;
  if (/M$/i.test(s)) return 100 + n;
  if (/Y$/i.test(s)) return 200 + n;
  return 300 + n;
};
export const sortSizes = (arr) => [...arr].sort((a, b) => sizeRank(a) - sizeRank(b) || String(a).localeCompare(String(b)));

export function discountPercent(original, discount) {
  if (!discount || !original || discount >= original) return 0;
  return Math.round(((original - discount) / original) * 100);
}

function shapeListRow(r) {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    sku: r.sku,
    category_id: r.category_id,
    category_name: r.category_name,
    category_slug: r.category_slug,
    parent_category_name: r.parent_category_name,
    original_price: r.original_price,
    discount_price: r.discount_price,
    price: r.discount_price ?? r.original_price,
    discount_percent: discountPercent(r.original_price, r.discount_price),
    is_new_arrival: r.is_new_arrival,
    is_featured: r.is_featured,
    is_best_seller: r.is_best_seller,
    is_trending: r.is_trending,
    is_active: r.is_active,
    fabric: r.fabric,
    image: r.image,
    image2: r.image2,
    sizes: sortSizes(r.sizes || []),
    colors: r.colors || [],
    total_stock: r.total_stock,
    threshold: r.threshold,
    stock_status: r.stock_status,
    view_count: r.view_count,
    enquiry_count: r.enquiry_count,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

const SORTS = {
  newest: 'p.created_at DESC, p.id DESC',
  oldest: 'p.created_at ASC, p.id ASC',
  price_asc: 'COALESCE(p.discount_price, p.original_price) ASC, p.id',
  price_desc: 'COALESCE(p.discount_price, p.original_price) DESC, p.id',
  popular: 'p.view_count DESC, p.id DESC',
  discount: '(p.original_price - COALESCE(p.discount_price, p.original_price)) / NULLIF(p.original_price,0) DESC NULLS LAST, p.id',
  name: 'p.name ASC',
  stock_asc: 's.total_stock ASC, p.id',
  stock_desc: 's.total_stock DESC, p.id',
  enquiries: 'p.enquiry_count DESC, p.id DESC',
};

/**
 * Flexible product listing used by both the storefront and admin.
 * opts.publicOnly restricts to active products in active categories.
 */
export async function listProducts(q = {}, opts = {}) {
  const threshold = await getLowStockThreshold();
  const w = new Where();
  w.params.push(threshold); // $1 used by the stock CTE

  if (opts.publicOnly) w.add('p.is_active = TRUE').add('c.is_active = TRUE');
  if (q.active === 'true') w.add('p.is_active = TRUE');
  if (q.active === 'false') w.add('p.is_active = FALSE');

  if (q.category) {
    w.add(
      `p.category_id IN (
        WITH RECURSIVE tree AS (
          SELECT id FROM product_categories WHERE slug = ?
          UNION ALL SELECT pc.id FROM product_categories pc JOIN tree t ON pc.parent_id = t.id
        ) SELECT id FROM tree)`,
      String(q.category),
    );
  }
  if (toInt(q.category_id)) {
    w.add(
      `p.category_id IN (
        WITH RECURSIVE tree AS (
          SELECT id FROM product_categories WHERE id = ?
          UNION ALL SELECT pc.id FROM product_categories pc JOIN tree t ON pc.parent_id = t.id
        ) SELECT id FROM tree)`,
      toInt(q.category_id),
    );
  }
  if (q.q) {
    const term = `%${String(q.q).trim().slice(0, 80)}%`;
    w.add(
      '(p.name ILIKE ? OR p.sku ILIKE ? OR c.name ILIKE ? OR pc.name ILIKE ? OR p.fabric ILIKE ? OR p.description ILIKE ?)',
      term, term, term, term, term, term,
    );
  }
  if (q.size) w.add('EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.is_active AND v.size = ?)', String(q.size));
  if (q.color) w.add('EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.is_active AND LOWER(v.color) = LOWER(?))', String(q.color));
  if (q.min_price) w.add('COALESCE(p.discount_price, p.original_price) >= ?', Number(q.min_price));
  if (q.max_price) w.add('COALESCE(p.discount_price, p.original_price) <= ?', Number(q.max_price));
  if (q.in_stock === 'true') w.add('s.total_stock > 0');
  if (q.stock_status && ['in_stock', 'low_stock', 'out_of_stock'].includes(q.stock_status)) {
    w.add(`${stockStatusSql('s.total_stock', 's.threshold')} = ?`, q.stock_status);
  }
  switch (q.tag) {
    case 'new':
      w.add(`(p.is_new_arrival OR p.created_at > NOW() - INTERVAL '30 days')`);
      break;
    case 'featured':
      w.add('p.is_featured');
      break;
    case 'bestseller':
      w.add('p.is_best_seller');
      break;
    case 'trending':
      w.add('p.is_trending');
      break;
    case 'offers':
      w.add('p.discount_price IS NOT NULL AND p.discount_price < p.original_price');
      break;
    default:
  }
  if (q.exclude_id) w.add('p.id <> ?', toInt(q.exclude_id));
  if (q.from) w.add('p.created_at >= ?', q.from);
  if (q.to) w.add(`p.created_at < (?::date + INTERVAL '1 day')`, q.to);

  const { page, limit, offset } = pageParams(q, opts.defaultLimit || 24, opts.maxLimit || 100);
  const order = SORTS[q.sort] || SORTS.newest;

  const sql = `
    ${productStockCte('$1')}
    SELECT p.*, c.name AS category_name, c.slug AS category_slug, pc.name AS parent_category_name,
           s.total_stock, s.threshold,
           ${stockStatusSql('s.total_stock', 's.threshold')} AS stock_status,
           (SELECT url FROM product_images i WHERE i.product_id = p.id ORDER BY i.is_primary DESC, i.sort_order, i.id LIMIT 1) AS image,
           (SELECT url FROM product_images i WHERE i.product_id = p.id ORDER BY i.is_primary DESC, i.sort_order, i.id OFFSET 1 LIMIT 1) AS image2,
           (SELECT COALESCE(json_agg(DISTINCT v.size), '[]'::json) FROM product_variants v WHERE v.product_id = p.id AND v.is_active) AS sizes,
           (SELECT COALESCE(json_agg(DISTINCT jsonb_build_object('name', v.color, 'hex', v.color_hex)), '[]'::json)
              FROM product_variants v WHERE v.product_id = p.id AND v.is_active) AS colors,
           COUNT(*) OVER()::int AS total_count
    FROM products p
    JOIN product_categories c ON c.id = p.category_id
    LEFT JOIN product_categories pc ON pc.id = c.parent_id
    JOIN stock s ON s.product_id = p.id
    ${w.sql}
    ORDER BY ${order}
    LIMIT ${limit} OFFSET ${offset}`;

  const rows = await query(sql, w.params);
  const total = rows[0]?.total_count || 0;
  return {
    items: rows.map(shapeListRow),
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

/** Full product with images, variants and per-variant stock. */
export async function getProduct({ id, slug }, opts = {}) {
  const threshold = await getLowStockThreshold();
  const p = await one(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug, c.is_active AS category_active,
            pc.name AS parent_category_name, pc.slug AS parent_category_slug
     FROM products p
     JOIN product_categories c ON c.id = p.category_id
     LEFT JOIN product_categories pc ON pc.id = c.parent_id
     WHERE ${id ? 'p.id = $1' : 'p.slug = $1'}`,
    [id ?? slug],
  );
  if (!p) return null;
  if (opts.publicOnly && (!p.is_active || !p.category_active)) return null;

  const images = await query(
    'SELECT id, url, alt_text, sort_order, is_primary FROM product_images WHERE product_id = $1 ORDER BY is_primary DESC, sort_order, id',
    [p.id],
  );
  const variants = await query(
    `SELECT v.id, v.size, v.color, v.color_hex, v.sku, v.is_active, COALESCE(i.quantity, 0)::int AS quantity, i.updated_at AS stock_updated_at
     FROM product_variants v LEFT JOIN inventory i ON i.variant_id = v.id
     WHERE v.product_id = $1 ${opts.publicOnly ? 'AND v.is_active' : ''}
     ORDER BY v.color, v.id`,
    [p.id],
  );
  const thr = p.low_stock_threshold ?? threshold;
  variants.sort((a, b) => a.color.localeCompare(b.color) || sizeRank(a.size) - sizeRank(b.size));
  for (const v of variants) v.stock_status = stockStatus(v.quantity, thr);
  const total = variants.filter((v) => v.is_active).reduce((sum, v) => sum + v.quantity, 0);

  const colors = [];
  const seen = new Set();
  for (const v of variants) {
    if (!seen.has(v.color)) {
      seen.add(v.color);
      colors.push({ name: v.color, hex: v.color_hex });
    }
  }

  return {
    ...p,
    price: p.discount_price ?? p.original_price,
    discount_percent: discountPercent(p.original_price, p.discount_price),
    effective_threshold: thr,
    images,
    variants,
    sizes: sortSizes([...new Set(variants.map((v) => v.size))]),
    colors,
    total_stock: total,
    stock_status: stockStatus(total, thr),
  };
}
