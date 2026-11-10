import { Router } from 'express';
import { z } from 'zod';
import { query, transaction } from '../../db/index.js';
import { ah, validate, Where, pageParams, toInt } from '../../utils/helpers.js';
import { can } from '../../middleware/auth.js';
import { applyStockMovement, stockStatusSql } from '../../services/inventory.js';
import { getLowStockThreshold } from '../../services/settings.js';

const router = Router();

/** Size-wise and colour-wise stock — one row per variant. */
router.get(
  '/',
  ah(async (req, res) => {
    const threshold = await getLowStockThreshold();
    const w = new Where();
    w.params.push(threshold); // $1
    const thr = 'COALESCE(p.low_stock_threshold, $1)';
    if (req.query.q) {
      const t = `%${String(req.query.q).slice(0, 80)}%`;
      w.add('(p.name ILIKE ? OR p.sku ILIKE ? OR v.sku ILIKE ? OR v.color ILIKE ?)', t, t, t, t);
    }
    if (toInt(req.query.category_id)) {
      w.add(
        `p.category_id IN (WITH RECURSIVE tree AS (SELECT id FROM product_categories WHERE id = ?
           UNION ALL SELECT c2.id FROM product_categories c2 JOIN tree t ON c2.parent_id = t.id) SELECT id FROM tree)`,
        toInt(req.query.category_id),
      );
    }
    if (toInt(req.query.product_id)) w.add('p.id = ?', toInt(req.query.product_id));
    if (req.query.size) w.add('v.size = ?', String(req.query.size));
    if (req.query.color) w.add('LOWER(v.color) = LOWER(?)', String(req.query.color));
    if (['in_stock', 'low_stock', 'out_of_stock'].includes(req.query.stock_status)) {
      w.add(`${stockStatusSql('COALESCE(i.quantity,0)', thr)} = ?`, req.query.stock_status);
    }
    const { page, limit, offset } = pageParams(req.query, 50, 500);
    const rows = await query(
      `SELECT v.id AS variant_id, v.size, v.color, v.color_hex, v.sku AS variant_sku, v.is_active,
              p.id AS product_id, p.name AS product_name, p.sku AS product_sku, c.name AS category_name,
              COALESCE(i.quantity,0)::int AS quantity, ${thr}::int AS threshold, i.updated_at,
              ${stockStatusSql('COALESCE(i.quantity,0)', thr)} AS stock_status,
              (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.sort_order LIMIT 1) AS image,
              COUNT(*) OVER()::int AS total_count
       FROM product_variants v
       JOIN products p ON p.id = v.product_id
       JOIN product_categories c ON c.id = p.category_id
       LEFT JOIN inventory i ON i.variant_id = v.id
       ${w.sql}
       ORDER BY p.name, v.color, v.size
       LIMIT ${limit} OFFSET ${offset}`,
      w.params,
    );
    const total = rows[0]?.total_count || 0;
    const totals = await query(
      `SELECT COALESCE(SUM(i.quantity),0)::int AS units, COUNT(*)::int AS variants
       FROM product_variants v JOIN products p ON p.id = v.product_id LEFT JOIN inventory i ON i.variant_id = v.id
       ${w.sql ? `${w.sql} AND` : 'WHERE'} $1::int IS NOT NULL`,
      w.params,
    );
    res.json({ items: rows, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)), summary: totals[0] });
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
    const results = await transaction(async (tx) => {
      const out = [];
      for (const m of parsed) {
        out.push(
          await applyStockMovement(tx, {
            variantId: m.variant_id,
            type: m.type,
            quantity: m.quantity,
            reason: m.reason,
            reference: m.reference,
            adminUserId: req.user.id,
          }),
        );
      }
      return out;
    });
    res.status(201).json({ ok: true, results });
  }),
);

/** Stock history (stock in / stock out / adjustments). */
router.get(
  '/transactions',
  ah(async (req, res) => {
    const w = new Where();
    if (toInt(req.query.product_id)) w.add('t.product_id = ?', toInt(req.query.product_id));
    if (toInt(req.query.variant_id)) w.add('t.variant_id = ?', toInt(req.query.variant_id));
    if (['IN', 'OUT', 'ADJUST'].includes(req.query.type)) w.add('t.type = ?', req.query.type);
    if (req.query.from) w.add('t.created_at >= ?::date', req.query.from);
    if (req.query.to) w.add(`t.created_at < (?::date + INTERVAL '1 day')`, req.query.to);
    if (req.query.q) {
      const t = `%${String(req.query.q).slice(0, 80)}%`;
      w.add('(p.name ILIKE ? OR p.sku ILIKE ? OR t.reference ILIKE ?)', t, t, t);
    }
    const { page, limit, offset } = pageParams(req.query, 50, 500);
    const rows = await query(
      `SELECT t.*, p.name AS product_name, p.sku AS product_sku, a.name AS admin_name, COUNT(*) OVER()::int AS total_count
       FROM stock_transactions t
       JOIN products p ON p.id = t.product_id
       LEFT JOIN admin_users a ON a.id = t.admin_user_id
       ${w.sql}
       ORDER BY t.created_at DESC, t.id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      w.params,
    );
    const total = rows[0]?.total_count || 0;
    res.json({ items: rows, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
  }),
);

export default router;
