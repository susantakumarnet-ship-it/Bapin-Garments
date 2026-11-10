import { Router } from 'express';
import { col, dateRange } from '../../db/index.js';
import { ah, toInt } from '../../utils/helpers.js';
import { categoryTree, loadCatalog } from '../../services/catalog.js';

const router = Router();

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');
const monthKey = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
const dayKey = (d) => d.toISOString().slice(0, 10);

router.get(
  '/',
  ah(async (req, res) => {
    const q = req.query;
    const { threshold, categories, catById, products } = await loadCatalog();

    // ---- Filtered product set (fp) ----
    const categoryId = toInt(q.category_id);
    const productId = toInt(q.product_id);
    const stockFilter = ['in_stock', 'low_stock', 'out_of_stock'].includes(q.stock_status) ? q.stock_status : null;
    const catIds = categoryId ? categoryTree(categories, (c) => c.id === categoryId) : null;
    const fp = products.filter(
      (p) => (!catIds || catIds.has(p.category_id)) && (!productId || p.id === productId) && (!stockFilter || p.stock_status === stockFilter),
    );
    const productFiltered = Boolean(categoryId || productId || stockFilter);
    const fpIds = fp.map((p) => p.id);
    const fpById = new Map(fp.map((p) => [p.id, p]));

    // ---- Enquiry filter (date range + filtered products) ----
    const enqFilter = {};
    const range = dateRange(q.from, q.to);
    if (range) enqFilter.created_at = range;
    if (productFiltered) enqFilter.product_id = { $in: fpIds };

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29));
    const enquiries = col('customer_enquiries');

    const [enqTotal, enqNew, enq7, enquiredGroups, recentEnquiries, trendGroups, moveGroups] = await Promise.all([
      enquiries.countDocuments(enqFilter),
      enquiries.countDocuments({ ...enqFilter, status: 'New' }),
      enquiries.countDocuments({ ...enqFilter, created_at: { ...(range || {}), $gt: new Date(Date.now() - 7 * 86400000) } }),
      enquiries
        .aggregate([
          { $match: { ...(range ? { created_at: range } : {}), product_id: { $in: fpIds } } },
          { $group: { _id: '$product_id', n: { $sum: 1 } } },
        ])
        .toArray(),
      enquiries
        .find(enqFilter, { projection: { _id: 0, id: 1, name: 1, mobile: 1, product_name: 1, subject: 1, status: 1, created_at: 1 } })
        .sort({ created_at: -1 })
        .limit(6)
        .toArray(),
      enquiries
        .aggregate([
          { $match: { created_at: { $gte: dayStart } } },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } }, n: { $sum: 1 } } },
        ])
        .toArray(),
      col('stock_transactions')
        .aggregate([
          { $match: { created_at: { $gte: monthStart }, type: { $in: ['IN', 'OUT'] }, product_id: { $in: fpIds } } },
          {
            $group: {
              _id: { m: { $dateToString: { format: '%Y-%m', date: '$created_at' } }, type: '$type' },
              qty: { $sum: '$quantity' },
            },
          },
        ])
        .toArray(),
    ]);

    // ---- Cards ----
    const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
    const count = (f) => fp.filter(f).length;

    // Roll leaf categories up to their top-level parent (Men / Women / Kids / Collections).
    const rootOf = (id) => {
      let c = catById.get(id);
      for (let i = 0; c?.parent_id && i < 10; i++) c = catById.get(c.parent_id);
      return c;
    };
    const byCategory = new Map();
    for (const p of fp) {
      const cur = byCategory.get(p.category_id) || { units: 0, products: 0 };
      cur.units += p.total_stock;
      cur.products += 1;
      byCategory.set(p.category_id, cur);
    }
    const rootTotals = new Map();
    const leaf = [...byCategory.entries()]
      .map(([categoryIdKey, r]) => {
        const key = rootOf(categoryIdKey)?.name || 'Other';
        const cur = rootTotals.get(key) || { name: key, units: 0, products: 0 };
        cur.units += r.units;
        cur.products += r.products;
        rootTotals.set(key, cur);
        return { name: catById.get(categoryIdKey)?.name || 'Unknown', group: key, units: r.units, products: r.products };
      })
      .sort((a, b) => b.units - a.units);

    // ---- Monthly series (last 12 months) ----
    const moves = new Map(moveGroups.map((g) => [`${g._id.m}|${g._id.type}`, g.qty]));
    const monthly = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + i, 1));
      const key = monthKey(d);
      monthly.push({
        label: `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`,
        month: key,
        products_added: count((p) => monthKey(new Date(p.created_at)) === key),
        stock_in: moves.get(`${key}|IN`) || 0,
        stock_out: moves.get(`${key}|OUT`) || 0,
      });
    }

    // ---- Enquiry trend (last 30 days) ----
    const trend = new Map(trendGroups.map((g) => [g._id, g.n]));
    const enquiryTrend = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(dayStart.getTime() + i * 86400000);
      enquiryTrend.push({ label: `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]}`, enquiries: trend.get(dayKey(d)) || 0 });
    }

    const lowStock = fp
      .flatMap((p) =>
        p.variants
          .filter((v) => v.is_active && v.quantity <= p.threshold)
          .map((v) => ({ variant_id: v.id, product_id: p.id, name: p.name, sku: p.sku, size: v.size, color: v.color, quantity: v.quantity, threshold: p.threshold })),
      )
      .sort((a, b) => a.quantity - b.quantity || a.name.localeCompare(b.name))
      .slice(0, 10);

    const statusOrder = ['in_stock', 'low_stock', 'out_of_stock'];
    res.json({
      threshold,
      cards: {
        total_products: fp.length,
        total_categories: categories.length,
        total_units: sum(fp, (p) => p.total_stock),
        out_of_stock: count((p) => p.stock_status === 'out_of_stock'),
        low_stock: count((p) => p.stock_status === 'low_stock'),
        total_enquiries: enqTotal,
        new_enquiries: enqNew,
        featured: count((p) => p.is_featured),
        stock_value: sum(fp, (p) => p.total_stock * p.price),
        enquiries_7d: enq7,
      },
      charts: {
        category_stock: [...rootTotals.values()].sort((a, b) => b.units - a.units),
        category_stock_detail: leaf.slice(0, 15),
        availability: statusOrder.map((s) => {
          const list = fp.filter((p) => p.stock_status === s);
          return { status: s, products: list.length, units: sum(list, (p) => p.total_stock) };
        }),
        monthly,
        most_viewed: [...fp]
          .sort((a, b) => b.view_count - a.view_count || a.id - b.id)
          .slice(0, 8)
          .map((p) => ({ id: p.id, name: p.name, sku: p.sku, view_count: p.view_count })),
        most_enquired: enquiredGroups
          .filter((g) => fpById.has(g._id))
          .sort((a, b) => b.n - a.n || a._id - b._id)
          .slice(0, 8)
          .map((g) => ({ id: g._id, name: fpById.get(g._id).name, sku: fpById.get(g._id).sku, enquiries: g.n })),
        enquiry_trend: enquiryTrend,
      },
      low_stock_items: lowStock,
      recent_enquiries: recentEnquiries,
    });
  }),
);

export default router;
