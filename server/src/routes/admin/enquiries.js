import { Router } from 'express';
import { z } from 'zod';
import { col, NO_ID, dateRange, likeRegex } from '../../db/index.js';
import { ah, validate, HttpError, pageParams, toInt } from '../../utils/helpers.js';
import { can } from '../../middleware/auth.js';
import { mapById } from '../../services/catalog.js';

const router = Router();
export const ENQUIRY_STATUSES = ['New', 'Contacted', 'Pending', 'Closed'];

/** Mongo filter for the enquiry list / report filters. */
export function enquiryFilter(q) {
  const filter = {};
  if (q.q) {
    const re = likeRegex(q.q);
    filter.$or = [{ name: re }, { mobile: re }, { email: re }, { product_name: re }, { subject: re }];
  }
  if (ENQUIRY_STATUSES.includes(q.status)) filter.status = q.status;
  const range = dateRange(q.from, q.to);
  if (range) filter.created_at = range;
  if (toInt(q.product_id)) filter.product_id = toInt(q.product_id);
  return filter;
}

router.get(
  '/',
  ah(async (req, res) => {
    const filter = enquiryFilter(req.query);
    const { page, limit, offset } = pageParams(req.query, 20, 200);
    const [rows, total, counts] = await Promise.all([
      col('customer_enquiries').find(filter, NO_ID).sort({ created_at: -1, id: -1 }).skip(offset).limit(limit).toArray(),
      col('customer_enquiries').countDocuments(filter),
      col('customer_enquiries').aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]).toArray(),
    ]);
    const products = await mapById('products', rows.map((r) => r.product_id), { slug: 1 });
    res.json({
      items: rows.map((e) => ({ ...e, product_slug: products.get(e.product_id)?.slug ?? null })),
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
      counts: Object.fromEntries(ENQUIRY_STATUSES.map((s) => [s, counts.find((c) => c._id === s)?.n || 0])),
    });
  }),
);

router.get(
  '/:id',
  ah(async (req, res) => {
    const e = await col('customer_enquiries').findOne({ id: Number(req.params.id) }, NO_ID);
    if (!e) throw new HttpError(404, 'Enquiry not found');
    const product = e.product_id ? await col('products').findOne({ id: e.product_id }) : null;
    const [history, notifications] = await Promise.all([
      col('customer_enquiries')
        .find({ mobile: e.mobile, id: { $ne: e.id } }, { projection: { _id: 0, id: 1, subject: 1, product_name: 1, status: 1, created_at: 1 } })
        .sort({ created_at: -1 })
        .limit(10)
        .toArray(),
      col('whatsapp_notification_logs')
        .find({ enquiry_id: e.id }, { projection: { _id: 0, id: 1, status: 1, error: 1, template_name: 1, created_at: 1 } })
        .sort({ id: -1 })
        .toArray(),
    ]);
    res.json({ ...e, product_slug: product?.slug ?? null, product_sku: product?.sku ?? null, history, notifications });
  }),
);

router.put(
  '/:id',
  can('enquiries.write'),
  ah(async (req, res) => {
    const d = validate(
      z.object({
        status: z.enum(ENQUIRY_STATUSES).optional(),
        internal_remarks: z.string().max(5000).optional(),
      }),
      req.body,
    );
    const set = { updated_at: new Date() };
    if (d.status !== undefined) set.status = d.status;
    if (d.internal_remarks !== undefined) set.internal_remarks = d.internal_remarks;
    const row = await col('customer_enquiries').findOneAndUpdate({ id: Number(req.params.id) }, { $set: set }, { returnDocument: 'after', ...NO_ID });
    if (!row) throw new HttpError(404, 'Enquiry not found');
    res.json(row);
  }),
);

router.delete(
  '/:id',
  can('enquiries.delete'),
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const { deletedCount } = await col('customer_enquiries').deleteOne({ id });
    if (!deletedCount) throw new HttpError(404, 'Enquiry not found');
    await col('whatsapp_notification_logs').updateMany({ enquiry_id: id }, { $set: { enquiry_id: null } });
    res.json({ ok: true });
  }),
);

export default router;
