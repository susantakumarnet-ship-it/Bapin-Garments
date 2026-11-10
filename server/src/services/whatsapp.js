/**
 * WhatsApp Business Cloud API integration (Meta Graph API).
 *
 * Credentials are read server-side only:
 *   1. Environment variables (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID) — preferred
 *   2. Encrypted values saved from the admin Settings page
 *
 * Business-initiated messages (e.g. an enquiry alert to the owner) must use a
 * pre-approved message TEMPLATE unless the owner messaged the business number in
 * the last 24 hours. See docs/WHATSAPP_SETUP.md for the template to register.
 */
import { col, insert } from '../db/index.js';
import { config } from '../config.js';
import { getAllSettings } from './settings.js';
import { digitsOnly } from '../utils/helpers.js';

export function buildEnquiryText(e) {
  return [
    'NEW CUSTOMER ENQUIRY – BAPIN GARMENTS',
    '',
    `Customer Name: ${e.name}`,
    `Mobile: ${e.mobile}`,
    e.email ? `Email: ${e.email}` : null,
    `Product: ${e.product_name || 'General enquiry'}`,
    `Subject: ${e.subject}`,
    `Message: ${e.message}`,
    '',
    'Please contact the customer.',
  ]
    .filter((l) => l !== null)
    .join('\n');
}

async function resolveCredentials() {
  const s = await getAllSettings();
  return {
    token: config.whatsapp.accessToken || s.wa_access_token,
    phoneNumberId: config.whatsapp.phoneNumberId || s.wa_phone_number_id,
    apiVersion: s.wa_api_version || config.whatsapp.apiVersion,
    useTemplate: String(s.wa_use_template) === 'true',
    templateName: s.wa_template_name,
    templateLang: s.wa_template_lang || 'en',
    enabled: String(s.notify_whatsapp_enabled) === 'true',
    ownerNumber: digitsOnly(s.notify_owner_number),
  };
}

// Template parameters cannot contain newlines/tabs or 4+ consecutive spaces.
const clean = (v, max = 900) =>
  String(v || '-')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {4,}/g, '   ')
    .slice(0, max);

async function logResult({ enquiryId, to, text, template, status, providerId, error }) {
  await insert('whatsapp_notification_logs', {
    enquiry_id: enquiryId || null,
    to_number: to || null,
    message: text,
    template_name: template || null,
    status,
    provider_message_id: providerId || null,
    error: error || null,
    created_at: new Date(),
  });
}

/** Low level send. Returns { ok, id?, error? }. */
async function sendToGraph(creds, to, { text, templateParams }) {
  const url = `https://graph.facebook.com/${creds.apiVersion}/${creds.phoneNumberId}/messages`;
  const body = creds.useTemplate
    ? {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: creds.templateName,
          language: { code: creds.templateLang },
          components: [
            {
              type: 'body',
              parameters: templateParams.map((p) => ({ type: 'text', text: clean(p) })),
            },
          ],
        },
      }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { preview_url: false, body: text } };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${creds.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data?.error?.message || `HTTP ${res.status}` };
    }
    return { ok: true, id: data?.messages?.[0]?.id };
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? 'Request timed out' : err.message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Notify the store owner about a new enquiry. Never throws — the result is
 * written to whatsapp_notification_logs.
 */
export async function notifyOwnerOfEnquiry(enquiry) {
  const text = buildEnquiryText(enquiry);
  try {
    const creds = await resolveCredentials();
    const base = { enquiryId: enquiry.id, to: creds.ownerNumber, text, template: creds.useTemplate ? creds.templateName : null };

    if (!creds.enabled) return logResult({ ...base, status: 'skipped', error: 'WhatsApp notifications disabled in settings' });
    if (!creds.ownerNumber) return logResult({ ...base, status: 'skipped', error: 'Owner WhatsApp number not configured' });
    if (!creds.token || !creds.phoneNumberId)
      return logResult({ ...base, status: 'skipped', error: 'WhatsApp API credentials not configured' });

    const result = await sendToGraph(creds, creds.ownerNumber, {
      text,
      // Template body: {{1}} name, {{2}} mobile, {{3}} product, {{4}} message
      templateParams: [enquiry.name, enquiry.mobile, enquiry.product_name || 'General enquiry', `${enquiry.subject} - ${enquiry.message}`],
    });
    await logResult({ ...base, status: result.ok ? 'sent' : 'failed', providerId: result.id, error: result.error });
    if (!result.ok) console.warn('[whatsapp] send failed:', result.error);
  } catch (err) {
    console.error('[whatsapp] unexpected error', err);
    await logResult({ enquiryId: enquiry.id, text, status: 'failed', error: err.message }).catch(() => {});
  }
}

/** Used by the admin "Send test message" button. */
export async function sendTestMessage() {
  const creds = await resolveCredentials();
  if (!creds.ownerNumber) return { ok: false, error: 'Owner WhatsApp number not configured' };
  if (!creds.token || !creds.phoneNumberId) return { ok: false, error: 'WhatsApp API credentials not configured' };
  const sample = {
    name: 'Test Customer',
    mobile: '9876543210',
    product_name: "Men's Casual Shirt",
    subject: 'Test notification',
    message: 'This is a test message from your Bapin Garments admin panel.',
  };
  const text = buildEnquiryText(sample);
  const result = await sendToGraph(creds, creds.ownerNumber, {
    text,
    templateParams: [sample.name, sample.mobile, sample.product_name, sample.message],
  });
  await logResult({
    to: creds.ownerNumber,
    text,
    template: creds.useTemplate ? creds.templateName : null,
    status: result.ok ? 'sent' : 'failed',
    providerId: result.id,
    error: result.error,
  });
  return result;
}

export async function whatsappStatus() {
  const c = await resolveCredentials();
  const last = await col('whatsapp_notification_logs').findOne({}, { sort: { id: -1 }, projection: { _id: 0, status: 1, created_at: 1, error: 1 } });
  return {
    configured: Boolean(c.token && c.phoneNumberId),
    token_source: config.whatsapp.accessToken ? 'environment' : c.token ? 'settings' : 'none',
    enabled: c.enabled,
    owner_number: c.ownerNumber,
    last,
  };
}
