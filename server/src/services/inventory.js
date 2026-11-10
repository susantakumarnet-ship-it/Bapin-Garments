import { col, insert } from '../db/index.js';

/** Make sure a variant has an inventory document (with a numeric id). */
async function ensureInventory(variantId, now) {
  if (await col('inventory').findOne({ variant_id: variantId })) return;
  try {
    await insert('inventory', { variant_id: variantId, quantity: 0, updated_at: now });
  } catch (err) {
    if (err?.code !== 11000) throw err; // created concurrently
  }
}
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

function checkQuantity(type, quantity) {
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 0) throw new HttpError(400, 'Quantity must be a whole number ≥ 0');
  if (type !== 'ADJUST' && qty === 0) throw new HttpError(400, 'Quantity must be greater than zero');
  if (!['IN', 'OUT', 'ADJUST'].includes(type)) throw new HttpError(400, 'Invalid transaction type');
  return qty;
}

/**
 * Check a batch of movements before applying any of them, so a bad line
 * (e.g. removing more than is in stock) rejects the whole batch.
 */
export async function validateMovements(movements) {
  const ids = [...new Set(movements.map((m) => m.variantId))];
  const [variants, stock] = await Promise.all([
    col('product_variants').find({ id: { $in: ids } }).toArray(),
    col('inventory').find({ variant_id: { $in: ids } }).toArray(),
  ]);
  const byId = new Map(variants.map((v) => [v.id, v]));
  const qty = new Map(stock.map((s) => [s.variant_id, s.quantity]));
  for (const m of movements) {
    const n = checkQuantity(m.type, m.quantity);
    const v = byId.get(m.variantId);
    if (!v) throw new HttpError(404, 'Variant not found');
    const cur = qty.get(v.id) ?? 0;
    if (m.type === 'OUT' && n > cur) throw new HttpError(400, `Cannot remove ${n}; only ${cur} in stock for ${v.size}/${v.color}`);
    qty.set(v.id, m.type === 'IN' ? cur + n : m.type === 'OUT' ? cur - n : n);
  }
}

/**
 * Apply a stock movement to a variant and record it in stock_transactions.
 * type: IN (add), OUT (remove), ADJUST (set absolute quantity).
 * Updates are atomic per variant (OUT can never take stock below zero).
 */
export async function applyStockMovement({ variantId, type, quantity, reason, reference, adminUserId, at }) {
  const qty = checkQuantity(type, quantity);
  const v = await col('product_variants').findOne({ id: variantId });
  if (!v) throw new HttpError(404, 'Variant not found');
  const now = at || new Date();
  await ensureInventory(variantId, now);

  let newQty;
  let delta;
  if (type === 'IN') {
    const r = await col('inventory').findOneAndUpdate(
      { variant_id: variantId },
      { $inc: { quantity: qty }, $set: { updated_at: now } },
      { returnDocument: 'after' },
    );
    newQty = r.quantity;
    delta = qty;
  } else if (type === 'OUT') {
    const r = await col('inventory').findOneAndUpdate(
      { variant_id: variantId, quantity: { $gte: qty } },
      { $inc: { quantity: -qty }, $set: { updated_at: now } },
      { returnDocument: 'after' },
    );
    if (!r) {
      const cur = (await col('inventory').findOne({ variant_id: variantId }))?.quantity ?? 0;
      throw new HttpError(400, `Cannot remove ${qty}; only ${cur} in stock for ${v.size}/${v.color}`);
    }
    newQty = r.quantity;
    delta = qty;
  } else {
    const before = await col('inventory').findOneAndUpdate(
      { variant_id: variantId },
      { $set: { quantity: qty, updated_at: now } },
      { returnDocument: 'before' },
    );
    const prev = before?.quantity ?? 0;
    newQty = qty;
    delta = qty - prev;
    if (delta === 0) return { variantId, quantity: newQty, unchanged: true };
  }

  await insert('stock_transactions', {
    product_id: v.product_id,
    variant_id: variantId,
    variant_label: `${v.size} / ${v.color}`,
    type,
    quantity: delta,
    balance_after: newQty,
    reason: reason || null,
    reference: reference || null,
    admin_user_id: adminUserId || null,
    created_at: now,
  });
  await col('products').updateOne({ id: v.product_id }, { $set: { updated_at: now } });
  return { variantId, quantity: newQty };
}
