import { HttpError } from '../utils/helpers.js';

/**
 * Stock status helper. A variant/product is:
 *   - out_of_stock when quantity <= 0
 *   - low_stock    when quantity <= threshold
 *   - in_stock     otherwise
 */
export function stockStatus(qty, threshold) {
  if (qty <= 0) return 'out_of_stock';
  if (qty <= threshold) return 'low_stock';
  return 'in_stock';
}

export const STATUS_LABEL = {
  in_stock: 'In Stock',
  low_stock: 'Low Stock',
  out_of_stock: 'Out of Stock',
};

/**
 * SQL fragment computing product total stock & effective threshold.
 * Use with `$X` = global threshold param.
 */
export const productStockCte = (thresholdParam) => `
  WITH stock AS (
    SELECT p.id AS product_id,
           COALESCE(SUM(i.quantity), 0)::int AS total_stock,
           COALESCE(p.low_stock_threshold, ${thresholdParam})::int AS threshold
    FROM products p
    LEFT JOIN product_variants v ON v.product_id = p.id AND v.is_active
    LEFT JOIN inventory i ON i.variant_id = v.id
    GROUP BY p.id
  )`;

export const stockStatusSql = (qtyExpr, thrExpr) =>
  `CASE WHEN ${qtyExpr} <= 0 THEN 'out_of_stock' WHEN ${qtyExpr} <= ${thrExpr} THEN 'low_stock' ELSE 'in_stock' END`;

/**
 * Apply a stock movement to a variant inside a transaction.
 * type: IN (add), OUT (remove), ADJUST (set absolute quantity).
 */
export async function applyStockMovement(tx, { variantId, type, quantity, reason, reference, adminUserId }) {
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 0) throw new HttpError(400, 'Quantity must be a whole number ≥ 0');
  if (type !== 'ADJUST' && qty === 0) throw new HttpError(400, 'Quantity must be greater than zero');

  const { rows } = await tx.query(
    `SELECT v.id, v.product_id, v.size, v.color, COALESCE(i.quantity, 0)::int AS quantity
     FROM product_variants v LEFT JOIN inventory i ON i.variant_id = v.id
     WHERE v.id = $1 FOR UPDATE OF v`,
    [variantId],
  );
  const v = rows[0];
  if (!v) throw new HttpError(404, 'Variant not found');

  let newQty;
  let delta;
  if (type === 'IN') {
    newQty = v.quantity + qty;
    delta = qty;
  } else if (type === 'OUT') {
    if (qty > v.quantity) throw new HttpError(400, `Cannot remove ${qty}; only ${v.quantity} in stock for ${v.size}/${v.color}`);
    newQty = v.quantity - qty;
    delta = qty;
  } else if (type === 'ADJUST') {
    newQty = qty;
    delta = qty - v.quantity;
    if (delta === 0) return { variantId, quantity: newQty, unchanged: true };
  } else {
    throw new HttpError(400, 'Invalid transaction type');
  }

  await tx.query(
    `INSERT INTO inventory (variant_id, quantity, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (variant_id) DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW()`,
    [variantId, newQty],
  );
  await tx.query(
    `INSERT INTO stock_transactions
       (product_id, variant_id, variant_label, type, quantity, balance_after, reason, reference, admin_user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [v.product_id, variantId, `${v.size} / ${v.color}`, type, delta, newQty, reason || null, reference || null, adminUserId || null],
  );
  await tx.query('UPDATE products SET updated_at = NOW() WHERE id = $1', [v.product_id]);
  return { variantId, quantity: newQty };
}
