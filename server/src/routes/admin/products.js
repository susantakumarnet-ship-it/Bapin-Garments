import { Router } from 'express';
import { z } from 'zod';
import { query, one, transaction } from '../../db/index.js';
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

async function uniqueSlug(tx, name, excludeId) {
  const base = slugify(name);
  let slug = base;
  for (let i = 2; ; i++) {
    const { rows } = await tx.query('SELECT 1 FROM products WHERE slug = $1 AND ($2::int IS NULL OR id <> $2)', [slug, excludeId || null]);
    if (!rows.length) return slug;
    slug = `${base}-${i}`;
  }
}

/** Create/update/remove variants and record opening stock or adjustments. */
async function syncVariants(tx, productId, productSku, variants, adminUserId, isNew) {
  const { rows: existing } = await tx.query(
    'SELECT v.id, v.size, v.color, COALESCE(i.quantity,0)::int AS quantity FROM product_variants v LEFT JOIN inventory i ON i.variant_id = v.id WHERE v.product_id = $1',
    [productId],
  );
  const existingById = new Map(existing.map((v) => [v.id, v]));
  const keep = new Set();

  for (const v of variants) {
    const match =
      (v.id && existingById.get(v.id)) ||
      existing.find((e) => e.size.toLowerCase() === v.size.toLowerCase() && e.color.toLowerCase() === v.color.toLowerCase());

    if (match) {
      keep.add(match.id);
      await tx.query(
        'UPDATE product_variants SET size=$2, color=$3, color_hex=$4, sku=$5, is_active=$6 WHERE id=$1',
        [match.id, v.size, v.color, v.color_hex || null, variantSku(productSku, v), v.is_active],
      );
      if (v.quantity !== match.quantity) {
        await applyStockMovement(tx, {
          variantId: match.id,
          type: 'ADJUST',
          quantity: v.quantity,
          reason: 'Updated from product form',
          adminUserId,
        });
      }
    } else {
      const { rows } = await tx.query(
        'INSERT INTO product_variants (product_id, size, color, color_hex, sku, is_active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
        [productId, v.size, v.color, v.color_hex || null, variantSku(productSku, v), v.is_active],
      );
      const vid = rows[0].id;
      keep.add(vid);
      await tx.query('INSERT INTO inventory (variant_id, quantity) VALUES ($1, 0)', [vid]);
      if (v.quantity > 0) {
        await applyStockMovement(tx, {
          variantId: vid,
          type: 'IN',
          quantity: v.quantity,
          reason: isNew ? 'Opening stock' : 'New variant opening stock',
          adminUserId,
        });
      }
    }
  }

  for (const e of existing) {
    if (!keep.has(e.id)) {
      if (e.quantity > 0) {
        await applyStockMovement(tx, { variantId: e.id, type: 'OUT', quantity: e.quantity, reason: 'Variant removed', adminUserId });
      }
      await tx.query('DELETE FROM product_variants WHERE id = $1', [e.id]);
    }
  }
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
    const id = await transaction(async (tx) => {
      const slug = await uniqueSlug(tx, d.name);
      const { rows } = await tx.query(
        `INSERT INTO products (name, slug, sku, category_id, description, fabric, original_price, discount_price,
           is_new_arrival, is_featured, is_best_seller, is_trending, is_active, low_stock_threshold)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
        [d.name, slug, d.sku.toUpperCase(), d.category_id, d.description, d.fabric, d.original_price, d.discount_price ?? null,
          d.is_new_arrival, d.is_featured, d.is_best_seller, d.is_trending, d.is_active, d.low_stock_threshold ?? null],
      );
      await syncVariants(tx, rows[0].id, d.sku.toUpperCase(), d.variants, req.user.id, true);
      return rows[0].id;
    });
    res.status(201).json(await getProduct({ id }));
  }),
);

router.put(
  '/:id',
  can('products.write'),
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const d = validate(productSchema, normaliseBody(req.body));
    assertUniqueVariants(d.variants);
    await transaction(async (tx) => {
      const { rows: cur } = await tx.query('SELECT id, name, slug FROM products WHERE id = $1', [id]);
      if (!cur[0]) throw new HttpError(404, 'Product not found');
      const slug = cur[0].name === d.name ? cur[0].slug : await uniqueSlug(tx, d.name, id);
      await tx.query(
        `UPDATE products SET name=$2, slug=$3, sku=$4, category_id=$5, description=$6, fabric=$7, original_price=$8,
           discount_price=$9, is_new_arrival=$10, is_featured=$11, is_best_seller=$12, is_trending=$13, is_active=$14,
           low_stock_threshold=$15, updated_at=NOW()
         WHERE id=$1`,
        [id, d.name, slug, d.sku.toUpperCase(), d.category_id, d.description, d.fabric, d.original_price, d.discount_price ?? null,
          d.is_new_arrival, d.is_featured, d.is_best_seller, d.is_trending, d.is_active, d.low_stock_threshold ?? null],
      );
      if (Array.isArray(req.body.variants)) {
        await syncVariants(tx, id, d.sku.toUpperCase(), d.variants, req.user.id, false);
      }
    });
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
    const row = await one(
      'UPDATE products SET original_price=$2, discount_price=$3, updated_at=NOW() WHERE id=$1 RETURNING id',
      [Number(req.params.id), d.original_price, d.discount_price],
    );
    if (!row) throw new HttpError(404, 'Product not found');
    res.json({ ok: true });
  }),
);

router.delete(
  '/:id',
  can('products.delete'),
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const images = await query('SELECT storage_key FROM product_images WHERE product_id = $1', [id]);
    const row = await one('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
    if (!row) throw new HttpError(404, 'Product not found');
    await Promise.all(images.map((i) => deleteImage(i.storage_key)));
    res.json({ ok: true });
  }),
);

// ---------- Images ----------

router.post(
  '/:id/images',
  can('products.write'),
  imageUpload.array('images', 10),
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const product = await one('SELECT id, name FROM products WHERE id = $1', [id]);
    if (!product) throw new HttpError(404, 'Product not found');
    if (!req.files?.length) throw new HttpError(400, 'Choose at least one image');

    const count = await one('SELECT COUNT(*)::int AS n, MAX(sort_order) AS max FROM product_images WHERE product_id = $1', [id]);
    if (count.n + req.files.length > 12) throw new HttpError(400, 'A product can have at most 12 images');

    let order = (count.max ?? -1) + 1;
    for (const f of req.files) {
      const saved = await saveImage(f.buffer, 'products');
      await query(
        'INSERT INTO product_images (product_id, url, storage_key, alt_text, sort_order, is_primary) VALUES ($1,$2,$3,$4,$5,$6)',
        [id, saved.url, saved.key, product.name, order, count.n === 0 && order === (count.max ?? -1) + 1],
      );
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
    const count = await one('SELECT COUNT(*)::int AS n, MAX(sort_order) AS max FROM product_images WHERE product_id = $1', [id]);
    const product = await one('SELECT name FROM products WHERE id = $1', [id]);
    if (!product) throw new HttpError(404, 'Product not found');
    await query(
      'INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary) VALUES ($1,$2,$3,$4,$5)',
      [id, url, product.name, (count.max ?? -1) + 1, count.n === 0],
    );
    res.status(201).json((await getProduct({ id })).images);
  }),
);

router.put(
  '/:id/images/:imageId/primary',
  can('products.write'),
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const imageId = Number(req.params.imageId);
    await transaction(async (tx) => {
      const { rows } = await tx.query('SELECT id FROM product_images WHERE id = $1 AND product_id = $2', [imageId, id]);
      if (!rows[0]) throw new HttpError(404, 'Image not found');
      await tx.query('UPDATE product_images SET is_primary = (id = $2) WHERE product_id = $1', [id, imageId]);
    });
    res.json((await getProduct({ id })).images);
  }),
);

router.delete(
  '/:id/images/:imageId',
  can('products.write'),
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const img = await one('DELETE FROM product_images WHERE id = $1 AND product_id = $2 RETURNING *', [Number(req.params.imageId), id]);
    if (!img) throw new HttpError(404, 'Image not found');
    await deleteImage(img.storage_key);
    if (img.is_primary) {
      await query(
        `UPDATE product_images SET is_primary = TRUE WHERE id = (SELECT id FROM product_images WHERE product_id = $1 ORDER BY sort_order, id LIMIT 1)`,
        [id],
      );
    }
    res.json((await getProduct({ id })).images);
  }),
);

export default router;
