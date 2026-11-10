import { col, NO_ID, dayBound, likeRegex } from '../db/index.js';
import { getLowStockThreshold } from './settings.js';
import { stockStatus } from './inventory.js';
import { categoryTree, loadCatalog, paginate } from './catalog.js';
import { pageParams, toInt } from '../utils/helpers.js';

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

const byId = (a, b) => a.id - b.id;
const time = (d) => new Date(d).getTime();
const discountRatio = (p) => (p.original_price ? (p.original_price - p.price) / p.original_price : -1);

const SORTS = {
  newest: (a, b) => time(b.created_at) - time(a.created_at) || b.id - a.id,
  oldest: (a, b) => time(a.created_at) - time(b.created_at) || byId(a, b),
  price_asc: (a, b) => a.price - b.price || byId(a, b),
  price_desc: (a, b) => b.price - a.price || byId(a, b),
  popular: (a, b) => b.view_count - a.view_count || b.id - a.id,
  discount: (a, b) => discountRatio(b) - discountRatio(a) || byId(a, b),
  name: (a, b) => a.name.localeCompare(b.name),
  stock_asc: (a, b) => a.total_stock - b.total_stock || byId(a, b),
  stock_desc: (a, b) => b.total_stock - a.total_stock || byId(a, b),
  enquiries: (a, b) => b.enquiry_count - a.enquiry_count || b.id - a.id,
};

/** Flatten an enriched catalogue product into the list-row shape used by the UI. */
function toListRow(p) {
  const active = p.variants.filter((v) => v.is_active);
  const colors = [];
  const seen = new Set();
  for (const v of active) {
    if (!seen.has(v.color)) {
      seen.add(v.color);
      colors.push({ name: v.color, hex: v.color_hex });
    }
  }
  return shapeListRow({
    ...p,
    category_name: p.category?.name,
    category_slug: p.category?.slug,
    parent_category_name: p.parent?.name ?? null,
    image: p.images[0]?.url ?? null,
    image2: p.images[1]?.url ?? null,
    sizes: [...new Set(active.map((v) => v.size))],
    colors,
  });
}

/**
 * Flexible product listing used by both the storefront and admin.
 * opts.publicOnly restricts to active products in active categories.
 */
export async function listProducts(q = {}, opts = {}) {
  const filter = {};
  if (opts.publicOnly || q.active === 'true') filter.is_active = true;
  if (q.active === 'false' && !opts.publicOnly) filter.is_active = false;
  const { categories, products } = await loadCatalog(filter);

  const tests = [];
  if (opts.publicOnly) tests.push((p) => p.category?.is_active);
  if (q.category) {
    const ids = categoryTree(categories, (c) => c.slug === String(q.category));
    tests.push((p) => ids.has(p.category_id));
  }
  if (toInt(q.category_id)) {
    const ids = categoryTree(categories, (c) => c.id === toInt(q.category_id));
    tests.push((p) => ids.has(p.category_id));
  }
  if (q.q) {
    const re = likeRegex(q.q);
    tests.push((p) => [p.name, p.sku, p.category?.name, p.parent?.name, p.fabric, p.description].some((v) => v && re.test(v)));
  }
  if (q.size) tests.push((p) => p.variants.some((v) => v.is_active && v.size === String(q.size)));
  if (q.color) {
    const c = String(q.color).toLowerCase();
    tests.push((p) => p.variants.some((v) => v.is_active && v.color.toLowerCase() === c));
  }
  if (q.min_price) tests.push((p) => p.price >= Number(q.min_price));
  if (q.max_price) tests.push((p) => p.price <= Number(q.max_price));
  if (q.in_stock === 'true') tests.push((p) => p.total_stock > 0);
  if (['in_stock', 'low_stock', 'out_of_stock'].includes(q.stock_status)) tests.push((p) => p.stock_status === q.stock_status);
  const monthAgo = Date.now() - 30 * 86400000;
  const TAGS = {
    new: (p) => p.is_new_arrival || time(p.created_at) > monthAgo,
    featured: (p) => p.is_featured,
    bestseller: (p) => p.is_best_seller,
    trending: (p) => p.is_trending,
    offers: (p) => p.discount_price != null && p.discount_price < p.original_price,
  };
  if (TAGS[q.tag]) tests.push(TAGS[q.tag]);
  if (q.exclude_id) tests.push((p) => p.id !== toInt(q.exclude_id));
  const from = dayBound(q.from);
  const to = dayBound(q.to, true);
  if (from) tests.push((p) => new Date(p.created_at) >= from);
  if (to) tests.push((p) => new Date(p.created_at) < to);

  const rows = products.filter((p) => tests.every((t) => t(p))).sort(SORTS[q.sort] || SORTS.newest);
  const pg = pageParams(q, opts.defaultLimit || 24, opts.maxLimit || 100);
  const page = paginate(rows, pg);
  return { ...page, items: page.items.map(toListRow) };
}

/** Full product with images, variants and per-variant stock. */
export async function getProduct({ id, slug }, opts = {}) {
  const threshold = await getLowStockThreshold();
  const p = await col('products').findOne(id ? { id } : { slug: String(slug) }, NO_ID);
  if (!p) return null;
  const c = await col('product_categories').findOne({ id: p.category_id }, NO_ID);
  const pc = c?.parent_id ? await col('product_categories').findOne({ id: c.parent_id }, NO_ID) : null;
  if (opts.publicOnly && (!p.is_active || !c?.is_active)) return null;

  const images = (
    await col('product_images')
      .find({ product_id: p.id }, { projection: { _id: 0, id: 1, url: 1, alt_text: 1, sort_order: 1, is_primary: 1 } })
      .toArray()
  ).sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order || a.id - b.id);

  const variantFilter = { product_id: p.id, ...(opts.publicOnly ? { is_active: true } : {}) };
  const rawVariants = await col('product_variants')
    .find(variantFilter, { projection: { _id: 0, id: 1, size: 1, color: 1, color_hex: 1, sku: 1, is_active: 1 } })
    .toArray();
  const stock = await col('inventory')
    .find({ variant_id: { $in: rawVariants.map((v) => v.id) } })
    .toArray();
  const stockById = new Map(stock.map((s) => [s.variant_id, s]));
  const variants = rawVariants.map((v) => ({
    ...v,
    quantity: stockById.get(v.id)?.quantity ?? 0,
    stock_updated_at: stockById.get(v.id)?.updated_at ?? null,
  }));

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
    category_name: c?.name ?? null,
    category_slug: c?.slug ?? null,
    category_active: c?.is_active ?? false,
    parent_category_name: pc?.name ?? null,
    parent_category_slug: pc?.slug ?? null,
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
