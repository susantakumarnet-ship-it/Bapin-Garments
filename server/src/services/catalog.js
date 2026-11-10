/**
 * Loads the catalogue (categories, products, variants, stock, images) and joins
 * it in memory. A clothing store's catalogue is small (hundreds to a few thousand
 * products), so this keeps listing, filtering, dashboards and reports simple
 * and identical to the old SQL behaviour.
 */
import { col, NO_ID } from '../db/index.js';
import { getLowStockThreshold } from './settings.js';
import { stockStatus } from './inventory.js';

const imageOrder = (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order || a.id - b.id;

/** Ids of a category and all of its descendants. */
export function categoryTree(categories, match) {
  const root = categories.find(match);
  if (!root) return new Set();
  const ids = new Set([root.id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of categories) {
      if (c.parent_id && ids.has(c.parent_id) && !ids.has(c.id)) {
        ids.add(c.id);
        grew = true;
      }
    }
  }
  return ids;
}

/**
 * Returns { threshold, categories, catById, products } where each product has:
 * category, parent, variants (with quantity), images, total_stock, threshold, stock_status.
 */
export async function loadCatalog(productFilter = {}) {
  const [threshold, categories, products, variants, inventory, images] = await Promise.all([
    getLowStockThreshold(),
    col('product_categories').find({}, NO_ID).toArray(),
    col('products').find(productFilter, NO_ID).toArray(),
    col('product_variants').find({}, NO_ID).toArray(),
    col('inventory').find({}, NO_ID).toArray(),
    col('product_images').find({}, NO_ID).toArray(),
  ]);
  const catById = new Map(categories.map((c) => [c.id, c]));
  const stockByVariant = new Map(inventory.map((i) => [i.variant_id, i]));
  const variantsByProduct = new Map();
  for (const v of variants) {
    const inv = stockByVariant.get(v.id);
    const full = { ...v, quantity: inv?.quantity ?? 0, stock_updated_at: inv?.updated_at ?? null };
    if (!variantsByProduct.has(v.product_id)) variantsByProduct.set(v.product_id, []);
    variantsByProduct.get(v.product_id).push(full);
  }
  const imagesByProduct = new Map();
  for (const img of images) {
    if (!imagesByProduct.has(img.product_id)) imagesByProduct.set(img.product_id, []);
    imagesByProduct.get(img.product_id).push(img);
  }

  const enriched = products.map((p) => {
    const category = catById.get(p.category_id) || null;
    const parent = category?.parent_id ? catById.get(category.parent_id) || null : null;
    const pv = variantsByProduct.get(p.id) || [];
    const imgs = (imagesByProduct.get(p.id) || []).sort(imageOrder);
    const thr = p.low_stock_threshold ?? threshold;
    const total = pv.filter((v) => v.is_active).reduce((s, v) => s + v.quantity, 0);
    return {
      ...p,
      category,
      parent,
      variants: pv,
      images: imgs,
      total_stock: total,
      threshold: thr,
      stock_status: stockStatus(total, thr),
      price: p.discount_price ?? p.original_price,
    };
  });
  return { threshold, categories, catById, products: enriched };
}

/** Paginate an in-memory array the same way the SQL endpoints did. */
export function paginate(items, { page, limit, offset }) {
  const total = items.length;
  return { items: items.slice(offset, offset + limit), page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
}

/** Lookup map { id -> doc } for a list of ids in a collection. */
export async function mapById(name, ids, projection) {
  const list = [...new Set(ids.filter((x) => x != null))];
  if (!list.length) return new Map();
  const docs = await col(name).find({ id: { $in: list } }, { projection: { _id: 0, ...(projection ? { id: 1, ...projection } : {}) } }).toArray();
  return new Map(docs.map((d) => [d.id, d]));
}
