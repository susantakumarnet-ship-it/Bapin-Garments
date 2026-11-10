import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../db/index.js';
import { ah, validate, pageParams, Where } from '../../utils/helpers.js';
import { can } from '../../middleware/auth.js';
import { getAdminSettings, updateSettings, clearSecret, SETTINGS_SCHEMA } from '../../services/settings.js';
import { sendTestMessage, whatsappStatus } from '../../services/whatsapp.js';

const router = Router();

const str = (max = 500) => z.string().max(max).optional();
const bool = z.union([z.boolean(), z.enum(['true', 'false'])]).transform(String).optional();
const phone = z
  .string()
  .trim()
  .max(20)
  .refine((v) => v === '' || /^\+?\d{10,15}$/.test(v.replace(/[\s-]/g, '')), 'Enter number with country code, e.g. 919876543210')
  .transform((v) => v.replace(/[\s+-]/g, ''))
  .optional();
const url = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => v === '' || /^https:\/\//.test(v), 'Must start with https://')
  .optional();

const settingsSchema = z
  .object({
    store_name: str(100),
    tagline: str(150),
    address: str(500),
    phone: str(40),
    whatsapp_number: phone,
    email: z.union([z.literal(''), z.string().email()]).optional(),
    business_hours: str(500),
    map_embed_url: url,
    map_link: url,
    social_facebook: url,
    social_instagram: url,
    social_youtube: url,
    social_twitter: url,
    announcement: str(300),
    about_text: str(3000),
    low_stock_threshold: z.coerce.number().int().min(0).max(100000).transform(String).optional(),
    notify_whatsapp_enabled: bool,
    notify_owner_number: phone,
    wa_phone_number_id: z.string().trim().regex(/^\d*$/, 'Phone Number ID is numeric').max(40).optional(),
    wa_business_account_id: z.string().trim().regex(/^\d*$/, 'Business Account ID is numeric').max(40).optional(),
    wa_api_version: z.string().trim().regex(/^v\d+\.\d+$/, 'Format like v21.0').optional(),
    wa_use_template: bool,
    wa_template_name: z.string().trim().regex(/^[a-z0-9_]*$/, 'Lowercase letters, numbers and _ only').max(100).optional(),
    wa_template_lang: z.string().trim().max(10).optional(),
    wa_access_token: z.string().trim().max(1000).optional(),
  })
  .strict();

router.get(
  '/',
  can('settings.view'),
  ah(async (_req, res) => {
    res.json({ settings: await getAdminSettings(), whatsapp: await whatsappStatus() });
  }),
);

router.put(
  '/',
  can('settings.write'),
  ah(async (req, res) => {
    const body = Object.fromEntries(Object.entries(req.body || {}).filter(([k]) => k in SETTINGS_SCHEMA));
    const d = validate(settingsSchema, body);
    await updateSettings(d);
    res.json({ settings: await getAdminSettings(), whatsapp: await whatsappStatus() });
  }),
);

router.delete(
  '/secret/:key',
  can('settings.write'),
  ah(async (req, res) => {
    await clearSecret(req.params.key);
    res.json({ settings: await getAdminSettings(), whatsapp: await whatsappStatus() });
  }),
);

router.post(
  '/whatsapp/test',
  can('settings.write'),
  ah(async (_req, res) => {
    const r = await sendTestMessage();
    res.status(r.ok ? 200 : 400).json(r.ok ? { ok: true, message: 'Test message sent to owner WhatsApp' } : { error: r.error });
  }),
);

router.get(
  '/whatsapp/logs',
  can('settings.view'),
  ah(async (req, res) => {
    const w = new Where();
    if (['sent', 'failed', 'skipped'].includes(req.query.status)) w.add('l.status = ?', req.query.status);
    const { page, limit, offset } = pageParams(req.query, 25, 200);
    const rows = await query(
      `SELECT l.*, e.name AS customer_name, COUNT(*) OVER()::int AS total_count
       FROM whatsapp_notification_logs l LEFT JOIN customer_enquiries e ON e.id = l.enquiry_id
       ${w.sql} ORDER BY l.id DESC LIMIT ${limit} OFFSET ${offset}`,
      w.params,
    );
    const total = rows[0]?.total_count || 0;
    res.json({ items: rows, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
  }),
);

export default router;
