import { Router } from 'express';
import { query, one } from '../../db/index.js';
import { ah, Where, toInt } from '../../utils/helpers.js';
import { getLowStockThreshold } from '../../services/settings.js';
import { productStockCte, stockStatusSql } from '../../services/inventory.js';

const router = Router();

const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

router.get(
  '/',
  ah(async (req, res) => {
    const q = req.query;
    const threshold = await getLowStockThreshold();

    // ---- Filtered product set (fp) ----
    const w = new Where();
    w.params.push(threshold); // $1
    const categoryId = toInt(q.category_id);
    const productId = toInt(q.product_id);
    const stockFilter = ['in_stock', 'low_stock', 'out_of_stock'].includes(q.stock_status) ? q.stock_status : null;
    if (categoryId) {
      w.add(
        `p.category_id IN (WITH RECURSIVE tree AS (SELECT id FROM product_categories WHERE id = ?
           UNION ALL SELECT c.id FROM product_categories c JOIN tree t ON c.parent_id = t.id) SELECT id FROM tree)`,
        categoryId,
      );
    }
    if (productId) w.add('p.id = ?', productId);
    if (stockFilter) w.add(`${stockStatusSql('s.total_stock', 's.threshold')} = ?`, stockFilter);
    const productFiltered = Boolean(categoryId || productId || stockFilter);

    const base = `${productStockCte('$1')},
      fp AS (
        SELECT p.*, s.total_stock, s.threshold, ${stockStatusSql('s.total_stock', 's.threshold')} AS stock_status
        FROM products p JOIN stock s ON s.product_id = p.id ${w.sql}
      )`;
    const P = w.params;

    // ---- Date filters for enquiries / movements ----
    const from = isDate(q.from) ? q.from : null;
    const to = isDate(q.to) ? q.to : null;
    const dateParams = [...P];
    const dateCond = (col) => {
      const parts = [];
      if (from) {
        dateParams.push(from);
        parts.push(`${col} >= $${dateParams.length}::date`);
      }
      if (to) {
        dateParams.push(to);
        parts.push(`${col} < ($${dateParams.length}::date + INTERVAL '1 day')`);
      }
      return parts.length ? parts.join(' AND ') : 'TRUE';
    };
    const enqDate = dateCond('e.created_at');
    const enqProduct = productFiltered ? 'e.product_id IN (SELECT id FROM fp)' : 'TRUE';

    const [cards, catCount, enq, categoryStock, categories, availability, mostViewed, mostEnquired, monthly, lowStock, recentEnquiries, enquiryTrend] =
      await Promise.all([
        one(
          `${base} SELECT COUNT(*)::int AS total_products,
                COALESCE(SUM(total_stock),0)::int AS total_units,
                COUNT(*) FILTER (WHERE stock_status = 'out_of_stock')::int AS out_of_stock,
                COUNT(*) FILTER (WHERE stock_status = 'low_stock')::int AS low_stock,
                COUNT(*) FILTER (WHERE stock_status = 'in_stock')::int AS in_stock,
                COUNT(*) FILTER (WHERE is_featured)::int AS featured,
                COUNT(*) FILTER (WHERE is_active)::int AS active_products,
                COALESCE(SUM(total_stock * COALESCE(discount_price, original_price)),0)::float AS stock_value
           FROM fp`,
          P,
        ),
        one('SELECT COUNT(*)::int AS n FROM product_categories'),
        one(
          `${base} SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE e.status = 'New')::int AS new_count,
                COUNT(*) FILTER (WHERE e.created_at > NOW() - INTERVAL '7 days')::int AS last_7_days
           FROM customer_enquiries e WHERE ${enqDate} AND ${enqProduct}`,
          dateParams,
        ),
        query(`${base} SELECT category_id, COALESCE(SUM(total_stock),0)::int AS units, COUNT(*)::int AS products FROM fp GROUP BY category_id`, P),
        query('SELECT id, name, parent_id FROM product_categories'),
        query(`${base} SELECT stock_status, COUNT(*)::int AS products, COALESCE(SUM(total_stock),0)::int AS units FROM fp GROUP BY stock_status`, P),
        query(`${base} SELECT id, name, sku, view_count FROM fp ORDER BY view_count DESC, id LIMIT 8`, P),
        query(
          `${base} SELECT fp.id, fp.name, fp.sku, COUNT(e.id)::int AS enquiries
           FROM customer_enquiries e JOIN fp ON fp.id = e.product_id
           WHERE ${enqDate} GROUP BY fp.id, fp.name, fp.sku ORDER BY enquiries DESC, fp.id LIMIT 8`,
          dateParams,
        ),
        query(
          `${base}, months AS (
             SELECT generate_series(date_trunc('month', NOW()) - INTERVAL '11 months', date_trunc('month', NOW()), INTERVAL '1 month') AS m
           )
           SELECT to_char(m, 'Mon YY') AS label, to_char(m, 'YYYY-MM') AS month,
             (SELECT COUNT(*) FROM fp WHERE date_trunc('month', fp.created_at) = m)::int AS products_added,
             (SELECT COALESCE(SUM(t.quantity),0) FROM stock_transactions t WHERE t.type = 'IN' AND t.product_id IN (SELECT id FROM fp)
                AND date_trunc('month', t.created_at) = m)::int AS stock_in,
             (SELECT COALESCE(SUM(t.quantity),0) FROM stock_transactions t WHERE t.type = 'OUT' AND t.product_id IN (SELECT id FROM fp)
                AND date_trunc('month', t.created_at) = m)::int AS stock_out
           FROM months ORDER BY m`,
          P,
        ),
        query(
          `${base} SELECT v.id AS variant_id, fp.id AS product_id, fp.name, fp.sku, v.size, v.color, COALESCE(i.quantity,0)::int AS quantity, fp.threshold
           FROM fp JOIN product_variants v ON v.product_id = fp.id AND v.is_active
           LEFT JOIN inventory i ON i.variant_id = v.id
           WHERE COALESCE(i.quantity,0) <= fp.threshold
           ORDER BY COALESCE(i.quantity,0), fp.name LIMIT 10`,
          P,
        ),
        query(
          `${base} SELECT e.id, e.name, e.mobile, e.product_name, e.subject, e.status, e.created_at
           FROM customer_enquiries e WHERE ${enqDate} AND ${enqProduct} ORDER BY e.created_at DESC LIMIT 6`,
          dateParams,
        ),
        query(
          `SELECT to_char(d, 'DD Mon') AS label,
                  (SELECT COUNT(*) FROM customer_enquiries e WHERE e.created_at >= d AND e.created_at < d + INTERVAL '1 day')::int AS enquiries
           FROM generate_series(date_trunc('day', NOW()) - INTERVAL '29 days', date_trunc('day', NOW()), INTERVAL '1 day') d ORDER BY d`,
        ),
      ]);

    // Roll leaf categories up to their top-level parent (Men / Women / Kids / Collections).
    const byId = new Map(categories.map((c) => [c.id, c]));
    const rootOf = (id) => {
      let c = byId.get(id);
      for (let i = 0; c?.parent_id && i < 10; i++) c = byId.get(c.parent_id);
      return c;
    };
    const rootTotals = new Map();
    const leaf = categoryStock
      .map((r) => {
        const root = rootOf(r.category_id);
        const key = root?.name || 'Other';
        const cur = rootTotals.get(key) || { name: key, units: 0, products: 0 };
        cur.units += r.units;
        cur.products += r.products;
        rootTotals.set(key, cur);
        return { name: byId.get(r.category_id)?.name || 'Unknown', group: key, units: r.units, products: r.products };
      })
      .sort((a, b) => b.units - a.units);

    const statusOrder = ['in_stock', 'low_stock', 'out_of_stock'];
    res.json({
      threshold,
      cards: {
        total_products: cards.total_products,
        total_categories: catCount.n,
        total_units: cards.total_units,
        out_of_stock: cards.out_of_stock,
        low_stock: cards.low_stock,
        total_enquiries: enq.total,
        new_enquiries: enq.new_count,
        featured: cards.featured,
        stock_value: cards.stock_value,
        enquiries_7d: enq.last_7_days,
      },
      charts: {
        category_stock: [...rootTotals.values()].sort((a, b) => b.units - a.units),
        category_stock_detail: leaf.slice(0, 15),
        availability: statusOrder.map((s) => ({
          status: s,
          products: availability.find((a) => a.stock_status === s)?.products || 0,
          units: availability.find((a) => a.stock_status === s)?.units || 0,
        })),
        monthly,
        most_viewed: mostViewed,
        most_enquired: mostEnquired,
        enquiry_trend: enquiryTrend,
      },
      low_stock_items: lowStock,
      recent_enquiries: recentEnquiries,
    });
  }),
);

export default router;
