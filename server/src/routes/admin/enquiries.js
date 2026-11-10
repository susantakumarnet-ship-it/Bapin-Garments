import { Router } from 'express';
import { z } from 'zod';
import { query, one } from '../../db/index.js';
import { ah, validate, HttpError, Where, pageParams, toInt } from '../../utils/helpers.js';
import { can } from '../../middleware/auth.js';

const router = Router();
export const ENQUIRY_STATUSES = ['New', 'Contacted', 'Pending', 'Closed'];

export function enquiryWhere(q) {
  const w = new Where();
  if (q.q) {
    const t = `%${String(q.q).trim().slice(0, 80)}%`;
    w.add('(e.name ILIKE ? OR e.mobile ILIKE ? OR e.email ILIKE ? OR e.product_name ILIKE ? OR e.subject ILIKE ?)', t, t, t, t, t);
  }
  if (ENQUIRY_STATUSES.includes(q.status)) w.add('e.status = ?', q.status);
  if (q.from) w.add('e.created_at >= ?::date', q.from);
  if (q.to) w.add(`e.created_at < (?::date + INTERVAL '1 day')`, q.to);
  if (toInt(q.product_id)) w.add('e.product_id = ?', toInt(q.product_id));
  return w;
}

router.get(
  '/',
  ah(async (req, res) => {
    const w = enquiryWhere(req.query);
    const { page, limit, offset } = pageParams(req.query, 20, 200);
    const rows = await query(
      `SELECT e.*, p.slug AS product_slug, COUNT(*) OVER()::int AS total_count
       FROM customer_enquiries e LEFT JOIN products p ON p.id = e.product_id
       ${w.sql} ORDER BY e.created_at DESC, e.id DESC LIMIT ${limit} OFFSET ${offset}`,
      w.params,
    );
    const counts = await query('SELECT status, COUNT(*)::int AS n FROM customer_enquiries GROUP BY status');
    const total = rows[0]?.total_count || 0;
    res.json({
      items: rows,
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
      counts: Object.fromEntries(ENQUIRY_STATUSES.map((s) => [s, counts.find((c) => c.status === s)?.n || 0])),
    });
  }),
);

router.get(
  '/:id',
  ah(async (req, res) => {
    const e = await one(
      `SELECT e.*, p.slug AS product_slug, p.sku AS product_sku FROM customer_enquiries e
       LEFT JOIN products p ON p.id = e.product_id WHERE e.id = $1`,
      [Number(req.params.id)],
    );
    if (!e) throw new HttpError(404, 'Enquiry not found');
    const history = await query(
      'SELECT id, subject, product_name, status, created_at FROM customer_enquiries WHERE mobile = $1 AND id <> $2 ORDER BY created_at DESC LIMIT 10',
      [e.mobile, e.id],
    );
    const notifications = await query(
      'SELECT id, status, error, template_name, created_at FROM whatsapp_notification_logs WHERE enquiry_id = $1 ORDER BY id DESC',
      [e.id],
    );
    res.json({ ...e, history, notifications });
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
    const row = await one(
      `UPDATE customer_enquiries SET status = COALESCE($2, status), internal_remarks = COALESCE($3, internal_remarks), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [Number(req.params.id), d.status ?? null, d.internal_remarks ?? null],
    );
    if (!row) throw new HttpError(404, 'Enquiry not found');
    res.json(row);
  }),
);

router.delete(
  '/:id',
  can('enquiries.delete'),
  ah(async (req, res) => {
    const row = await one('DELETE FROM customer_enquiries WHERE id = $1 RETURNING id', [Number(req.params.id)]);
    if (!row) throw new HttpError(404, 'Enquiry not found');
    res.json({ ok: true });
  }),
);

export default router;
