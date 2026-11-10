import { Router } from 'express';
import { z } from 'zod';
import { col, insert, NO_ID } from '../../db/index.js';
import { ah, validate, HttpError, slugify } from '../../utils/helpers.js';
import { can } from '../../middleware/auth.js';
import { imageUpload } from '../../middleware/security.js';
import { listProducts, getProduct } from '../../services/products.js';
import { applyStockMovement } from '../../services/inventory.js';
import { saveImage, deleteImage } from '../../services/storage.js';

const router = Router();

const money = z.coerce.number().min(0).max(10_000_000);

const variantSchema = z.object({
  id: z.coerce.number().int().positive().optional().nullable(),
  size: z.string().trim().min(1).max(20),
  color: z.string().trim().min(1).max(40),
  color_hex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{3,8}$/, 'Invalid colour code')
    .optional()
    .or(z.literal(''))
    .nullable(),
  sku: z.string().trim().max(80).optional().nullable(),
  quantity: z.coerce.number().int().min(0).max(1_000_000).optional().default(0),
  is_active: z.boolean().optional().default(true),
});

const productSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    sku: z.string().trim().min(2).max(60).regex(/^[A-Za-z0-9-_]+$/, 'SKU can contain letters, numbers, - and _ only'),
    category_id: z.coerce.number().int().positive('Select a category'),
    description: z.string().trim().max(5000).optional().default(''),
    fabric: z.string().trim().max(200).optional().default(''),
    original_price: money,
    discount_price: money.nullable().optional(),
    is_new_arrival: z.boolean().optional().default(false),
    is_featured: z.boolean().optional().default(false),
    is_best_seller: z.boolean().optional().default(false),
    is_trending: z.boolean().optional().default(false),
    is_active: z.boolean().optional().default(true),
    low_stock_threshold: z.coerce.number().int().min(0).max(100000).nullable().optional(),
    variants: z.array(variantSchema).max(200).optional().default([]),
  })
  .refine((d) => d.discount_price == null || d.discount_price <= d.original_price, {
    message: 'Discount price cannot be higher than original price',
    path: ['discount_price'],
  });

function normaliseBody(body) {
  const b = { ...body };
  if (b.discount_price === '' || b.discount_price === undefined) b.discount_price = null;
  if (b.low_stock_threshold === '' || b.low_stock_threshold === undefined) b.low_stock_threshold = null;
  return b;
}

function assertUniqueVariants(variants) {
  const keys = new Set();
  for (const v of variants) {
    const k = `${v.size.toLowerCase()}|${v.color.toLowerCase()}`;
    if (keys.has(k)) throw new HttpError(400, `Duplicate variant: ${v.size} / ${v.color}`);
    keys.add(k);
  }
}

const variantSku = (productSku, v) =>
  (v.sku && v.sku.trim()) || `${productSku}-${v.size}-${v.color}`.toUpperCase().replace(/[^A-Z0-9-]+/g, '').slice(0, 80);

async function uniqueSlug(name, excludeId) {
  const base = slugify(name);
  let slug = base;
  for (let i = 2; ; i++) {
    const clash = await col('products').findOne({ slug, ...(excludeId ? { id: { $ne: excludeId } } : {}) });
    if (!clash) return slug;
    slug = `${base}-${i}`;
  }
}

/** Fail early (before writing anything) if a variant SKU belongs to another product. */
async function assertVariantSkusFree(productId, productSku, variants) {
  const skus = variants.map((v) => variantSku(productSku, v));
  if (new Set(skus).size !== skus.length) throw new HttpError(400, 'Two variants would get the same SKU');
  const clash = await col('product_variants').findOne({ sku: { $in: skus }, product_id: { $ne: productId } });
  if (clash) throw new HttpError(409, `Variant SKU ${clash.sku} is already used by another product`);
}

/** Create/update/remove variants and record opening stock or adjustments. */
async function syncVariants(productId, productSku, variants, adminUserId, isNew) {
  const rows = await col('product_variants').find({ product_id: productId }, NO_ID).toArray();
  const stock = await col('inventory').find({ variant_id: { $in: rows.map((v) => v.id) } }).toArray();
  const qtyById = new Map(stock.map((s) => [s.variant_id, s.quantity]));
  const existing = rows.map((v) => ({ ...v, quantity: qtyById.get(v.id) ?? 0 }));
  const existingById = new Map(existing.map((v) => [v.id, v]));
  const matches = variants.map(
    (v) =>
      (v.id && existingById.get(v.id)) ||
      existing.find((e) => e.size.toLowerCase() === v.size.toLowerCase() && e.color.toLowerCase() === v.color.toLowerCase()),
  );
  const keep = new Set(matches.filter(Boolean).map((m) => m.id));

  // Remove dropped variants first so their size/colour/SKU can be reused.
  for (const e of existing) {
    if (keep.has(e.id)) continue;
    if (e.quantity > 0) {
      await applyStockMovement({ variantId: e.id, type: 'OUT', quantity: e.quantity, reason: 'Variant removed', adminUserId });
    }
    await col('product_variants').deleteOne({ id: e.id });
    await col('inventory').deleteOne({ variant_id: e.id });
    await col('stock_transactions').updateMany({ variant_id: e.id }, { $set: { variant_id: null } });
  }

  for (const [i, v] of variants.entries()) {
    const match = matches[i];
    const fields = { size: v.size, color: v.color, color_hex: v.color_hex || null, sku: variantSku(productSku, v), is_active: v.is_active };
    if (match) {
      await col('product_variants').updateOne({ id: match.id }, { $set: fields });
      if (v.quantity !== match.quantity) {
        await applyStockMovement({ variantId: match.id, type: 'ADJUST', quantity: v.quantity, reason: 'Updated from product form', adminUserId });
      }
    } else {
      const { id: vid } = await insert('product_variants', { product_id: productId, ...fields, created_at: new Date() });
      await insert('inventory', { variant_id: vid, quantity: 0, updated_at: new Date() });
      if (v.quantity > 0) {
        await applyStockMovement({
          variantId: vid,
          type: 'IN',
          quantity: v.quantity,
          reason: isNew ? 'Opening stock' : 'New variant opening stock',
          adminUserId,
        });
      }
    }
  }
}

/** Remove everything that belongs to a product (like ON DELETE CASCADE). */
async function deleteProductCascade(id) {
  const variantIds = (await col('product_variants').find({ product_id: id }, { projection: { id: 1 } }).toArray()).map((v) => v.id);
  await Promise.all([
    col('product_images').deleteMany({ product_id: id }),
    col('inventory').deleteMany({ variant_id: { $in: variantIds } }),
    col('product_variants').deleteMany({ product_id: id }),
    col('stock_transactions').deleteMany({ product_id: id }),
    col('customer_enquiries').updateMany({ product_id: id }, { $set: { product_id: null } }),
  ]);
}

const productFields = (d) => ({
  name: d.name,
  sku: d.sku.toUpperCase(),
  category_id: d.category_id,
  description: d.description,
  fabric: d.fabric,
  original_price: d.original_price,
  discount_price: d.discount_price ?? null,
  is_new_arrival: d.is_new_arrival,
  is_featured: d.is_featured,
  is_best_seller: d.is_best_seller,
  is_trending: d.is_trending,
  is_active: d.is_active,
  low_stock_threshold: d.low_stock_threshold ?? null,
});

async function assertCategory(id) {
  if (!(await col('product_categories').findOne({ id }))) throw new HttpError(400, 'Selected category does not exist');
}

async function assertSkuFree(sku, excludeId) {
  const clash = await col('products').findOne({ sku: sku.toUpperCase(), ...(excludeId ? { id: { $ne: excludeId } } : {}) });
  if (clash) throw new HttpError(409, 'A record with this sku already exists');
}

router.get(
  '/',
  ah(async (req, res) => res.json(await listProducts(req.query, { defaultLimit: 20, maxLimit: 200 }))),
);

router.get(
  '/:id',
  ah(async (req, res) => {
    const p = await getProduct({ id: Number(req.params.id) });
    if (!p) throw new HttpError(404, 'Product not found');
    res.json(p);
  }),
);

router.post(
  '/',
  can('products.write'),
  ah(async (req, res) => {
    const d = validate(productSchema, normaliseBody(req.body));
    assertUniqueVariants(d.variants);
    await assertCategory(d.category_id);
    await assertSkuFree(d.sku);
    await assertVariantSkusFree(-1, d.sku.toUpperCase(), d.variants);
    const now = new Date();
    const product = await insert('products', {
      ...productFields(d),
      slug: await uniqueSlug(d.name),
      view_count: 0,
      enquiry_count: 0,
      created_at: now,
      updated_at: now,
    });
    try {
      await syncVariants(product.id, d.sku.toUpperCase(), d.variants, req.user.id, true);
    } catch (err) {
      await deleteProductCascade(product.id);
      await col('products').deleteOne({ id: product.id });
      throw err;
    }
    res.status(201).json(await getProduct({ id: product.id }));
  }),
);

router.put(
  '/:id',
  can('products.write'),
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const d = validate(productSchema, normaliseBody(req.body));
    assertUniqueVariants(d.variants);
    const cur = await col('products').findOne({ id });
    if (!cur) throw new HttpError(404, 'Product not found');
    await assertCategory(d.category_id);
    await assertSkuFree(d.sku, id);
    const syncing = Array.isArray(req.body.variants);
    if (syncing) await assertVariantSkusFree(id, d.sku.toUpperCase(), d.variants);
    const slug = cur.name === d.name ? cur.slug : await uniqueSlug(d.name, id);
    await col('products').updateOne({ id }, { $set: { ...productFields(d), slug, updated_at: new Date() } });
    if (syncing) await syncVariants(id, d.sku.toUpperCase(), d.variants, req.user.id, false);
    res.json(await getProduct({ id }));
  }),
);

/** Quick price update from the product list. */
router.patch(
  '/:id/price',
  can('products.write'),
  ah(async (req, res) => {
    const d = validate(
      z
        .object({ original_price: money, discount_price: money.nullable() })
        .refine((x) => x.discount_price == null || x.discount_price <= x.original_price, 'Discount price cannot exceed original price'),
      normaliseBody(req.body),
    );
    const { matchedCount } = await col('products').updateOne(
      { id: Number(req.params.id) },
      { $set: { original_price: d.original_price, discount_price: d.discount_price, updated_at: new Date() } },
    );
    if (!matchedCount) throw new HttpError(404, 'Product not found');
    res.json({ ok: true });
  }),
);

router.delete(
  '/:id',
  can('products.delete'),
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const images = await col('product_images').find({ product_id: id }).toArray();
    const { deletedCount } = await col('products').deleteOne({ id });
    if (!deletedCount) throw new HttpError(404, 'Product not found');
    await deleteProductCascade(id);
    await Promise.all(images.map((i) => deleteImage(i.storage_key)));
    res.json({ ok: true });
  }),
);

// ---------- Images ----------

async function imageStats(productId) {
  const imgs = await col('product_images').find({ product_id: productId }, { projection: { sort_order: 1 } }).toArray();
  return { n: imgs.length, max: imgs.length ? Math.max(...imgs.map((i) => i.sort_order)) : null };
}

router.post(
  '/:id/images',
  can('products.write'),
  imageUpload.array('images', 10),
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const product = await col('products').findOne({ id });
    if (!product) throw new HttpError(404, 'Product not found');
    if (!req.files?.length) throw new HttpError(400, 'Choose at least one image');

    const count = await imageStats(id);
    if (count.n + req.files.length > 12) throw new HttpError(400, 'A product can have at most 12 images');

    let order = (count.max ?? -1) + 1;
    for (const f of req.files) {
      const saved = await saveImage(f.buffer, 'products');
      await insert('product_images', {
        product_id: id,
        url: saved.url,
        storage_key: saved.key,
        alt_text: product.name,
        sort_order: order,
        is_primary: count.n === 0 && order === (count.max ?? -1) + 1,
        created_at: new Date(),
      });
      order++;
    }
    res.status(201).json((await getProduct({ id })).images);
  }),
);

router.post(
  '/:id/images/url',
  can('products.write'),
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const { url } = validate(z.object({ url: z.string().trim().url().max(1000).refine((u) => /^https:\/\//.test(u), 'Use an https:// URL') }), req.body);
    const product = await col('products').findOne({ id });
    if (!product) throw new HttpError(404, 'Product not found');
    const count = await imageStats(id);
    await insert('product_images', {
      product_id: id,
      url,
      storage_key: null,
      alt_text: product.name,
      sort_order: (count.max ?? -1) + 1,
      is_primary: count.n === 0,
      created_at: new Date(),
    });
    res.status(201).json((await getProduct({ id })).images);
  }),
);

router.put(
  '/:id/images/:imageId/primary',
  can('products.write'),
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const imageId = Number(req.params.imageId);
    const img = await col('product_images').findOne({ id: imageId, product_id: id });
    if (!img) throw new HttpError(404, 'Image not found');
    await col('product_images').updateMany({ product_id: id, id: { $ne: imageId } }, { $set: { is_primary: false } });
    await col('product_images').updateOne({ id: imageId }, { $set: { is_primary: true } });
    res.json((await getProduct({ id })).images);
  }),
);

router.delete(
  '/:id/images/:imageId',
  can('products.write'),
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const img = await col('product_images').findOneAndDelete({ id: Number(req.params.imageId), product_id: id });
    if (!img) throw new HttpError(404, 'Image not found');
    await deleteImage(img.storage_key);
    if (img.is_primary) {
      const next = await col('product_images').findOne({ product_id: id }, { sort: { sort_order: 1, id: 1 } });
      if (next) await col('product_images').updateOne({ id: next.id }, { $set: { is_primary: true } });
    }
    res.json((await getProduct({ id })).images);
  }),
);

export default router;
