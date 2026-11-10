import { Router } from 'express';
import { z } from 'zod';
import { col, dateRange, likeRegex } from '../../db/index.js';
import { ah, validate, pageParams, toInt } from '../../utils/helpers.js';
import { can } from '../../middleware/auth.js';
import { applyStockMovement, stockStatus, validateMovements } from '../../services/inventory.js';
import { categoryTree, loadCatalog, mapById, paginate } from '../../services/catalog.js';

const router = Router();

/** Size-wise and colour-wise stock — one row per variant. */
router.get(
  '/',
  ah(async (req, res) => {
    const q = req.query;
    const { categories, products } = await loadCatalog();
    const re = q.q ? likeRegex(q.q) : null;
    const catIds = toInt(q.category_id) ? categoryTree(categories, (c) => c.id === toInt(q.category_id)) : null;
    const color = q.color ? String(q.color).toLowerCase() : null;
    const status = ['in_stock', 'low_stock', 'out_of_stock'].includes(q.stock_status) ? q.stock_status : null;

    const all = [];
    const totals = { units: 0, variants: 0 };
    for (const p of products) {
      if (catIds && !catIds.has(p.category_id)) continue;
      if (toInt(q.product_id) && p.id !== toInt(q.product_id)) continue;
      for (const v of p.variants) {
        if (re && ![p.name, p.sku, v.sku, v.color].some((x) => x && re.test(x))) continue;
        if (q.size && v.size !== String(q.size)) continue;
        if (color && v.color.toLowerCase() !== color) continue;
        const st = stockStatus(v.quantity, p.threshold);
        if (status && st !== status) continue;
        totals.units += v.quantity;
        totals.variants += 1;
        all.push({
          variant_id: v.id,
          size: v.size,
          color: v.color,
          color_hex: v.color_hex,
          variant_sku: v.sku,
          is_active: v.is_active,
          product_id: p.id,
          product_name: p.name,
          product_sku: p.sku,
          category_name: p.category?.name ?? null,
          quantity: v.quantity,
          threshold: p.threshold,
          updated_at: v.stock_updated_at,
          stock_status: st,
          image: p.images[0]?.url ?? null,
        });
      }
    }
    all.sort((a, b) => a.product_name.localeCompare(b.product_name) || a.color.localeCompare(b.color) || a.size.localeCompare(b.size));
    res.json({ ...paginate(all, pageParams(q, 50, 500)), summary: totals });
  }),
);

const movementSchema = z.object({
  variant_id: z.coerce.number().int().positive(),
  type: z.enum(['IN', 'OUT', 'ADJUST']),
  quantity: z.coerce.number().int().min(0).max(1_000_000),
  reason: z.string().trim().max(200).optional().default(''),
  reference: z.string().trim().max(100).optional().default(''),
});

router.post(
  '/transactions',
  can('stock.write'),
  ah(async (req, res) => {
    const items = Array.isArray(req.body.items) ? req.body.items : [req.body];
    const parsed = items.slice(0, 200).map((it) => validate(movementSchema, it));
    const movements = parsed.map((m) => ({
      variantId: m.variant_id,
      type: m.type,
      quantity: m.quantity,
      reason: m.reason,
      reference: m.reference,
      adminUserId: req.user.id,
    }));
    await validateMovements(movements); // reject the whole batch before changing anything
    const results = [];
    for (const m of movements) results.push(await applyStockMovement(m));
    res.status(201).json({ ok: true, results });
  }),
);

/** Stock history (stock in / stock out / adjustments). */
router.get(
  '/transactions',
  ah(async (req, res) => {
    const q = req.query;
    const filter = {};
    if (toInt(q.product_id)) filter.product_id = toInt(q.product_id);
    if (toInt(q.variant_id)) filter.variant_id = toInt(q.variant_id);
    if (['IN', 'OUT', 'ADJUST'].includes(q.type)) filter.type = q.type;
    const range = dateRange(q.from, q.to);
    if (range) filter.created_at = range;
    if (q.q) {
      const re = likeRegex(q.q);
      const ids = (
        await col('products')
          .find({ $or: [{ name: re }, { sku: re }] }, { projection: { id: 1 } })
          .toArray()
      ).map((p) => p.id);
      filter.$or = [{ product_id: { $in: ids } }, { reference: re }];
    }
    const { page, limit, offset } = pageParams(q, 50, 500);
    const [rows, total] = await Promise.all([
      col('stock_transactions').find(filter, { projection: { _id: 0 } }).sort({ created_at: -1, id: -1 }).skip(offset).limit(limit).toArray(),
      col('stock_transactions').countDocuments(filter),
    ]);
    const [products, admins] = await Promise.all([
      mapById('products', rows.map((r) => r.product_id), { name: 1, sku: 1 }),
      mapById('admin_users', rows.map((r) => r.admin_user_id), { name: 1 }),
    ]);
    const items = rows.map((t) => ({
      ...t,
      product_name: products.get(t.product_id)?.name ?? null,
      product_sku: products.get(t.product_id)?.sku ?? null,
      admin_name: admins.get(t.admin_user_id)?.name ?? null,
    }));
    res.json({ items, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
  }),
);

export default router;
