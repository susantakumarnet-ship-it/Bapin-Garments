import { col } from '../db/index.js';
import { encrypt, decrypt } from './crypto.js';

/**
 * Website settings are stored as key/value rows.
 * `public: true` keys are exposed to the storefront.
 * `secret: true` keys are encrypted at rest and never returned to any client.
 */
export const SETTINGS_SCHEMA = {
  store_name: { public: true, default: 'Bapin Garments' },
  tagline: { public: true, default: 'Your Style, Your Choice!' },
  address: { public: true, default: '12, Main Bazaar Road, Near Clock Tower, Bhubaneswar, Odisha 751001' },
  phone: { public: true, default: '+91 98765 43210' },
  whatsapp_number: { public: true, default: '919876543210' },
  email: { public: true, default: 'hello@bapingarments.com' },
  business_hours: { public: true, default: 'Mon - Sat: 10:00 AM - 9:00 PM\nSunday: 11:00 AM - 7:00 PM' },
  map_embed_url: {
    public: true,
    default: 'https://www.google.com/maps?q=Bhubaneswar+Odisha&output=embed',
  },
  map_link: { public: true, default: 'https://maps.google.com/?q=Bhubaneswar+Odisha' },
  social_facebook: { public: true, default: 'https://facebook.com/' },
  social_instagram: { public: true, default: 'https://instagram.com/' },
  social_youtube: { public: true, default: 'https://youtube.com/' },
  social_twitter: { public: true, default: '' },
  announcement: { public: true, default: 'Festive Sale Live — Flat 20-40% OFF on Ethnic Wear | Free alteration on all purchases' },
  about_text: {
    public: true,
    default:
      'Bapin Garments has been dressing families with love since 2005. From everyday essentials to grand wedding wear, we bring together quality fabrics, the latest trends and honest prices under one roof.',
  },
  low_stock_threshold: { public: false, default: '5' },

  // Notifications
  notify_whatsapp_enabled: { public: false, default: 'true' },
  notify_owner_number: { public: false, default: '919876543210' },

  // WhatsApp Business Cloud API (Meta)
  wa_phone_number_id: { public: false, default: '' },
  wa_business_account_id: { public: false, default: '' },
  wa_api_version: { public: false, default: 'v21.0' },
  wa_use_template: { public: false, default: 'true' },
  wa_template_name: { public: false, default: 'new_customer_enquiry' },
  wa_template_lang: { public: false, default: 'en' },
  wa_access_token: { public: false, secret: true, default: '' },
};

let cache = null;

export function invalidateSettings() {
  cache = null;
}

/** All settings with secrets decrypted — server-side use only. */
export async function getAllSettings() {
  if (cache) return cache;
  const rows = await col('website_settings').find({}).toArray();
  const out = {};
  for (const [k, def] of Object.entries(SETTINGS_SCHEMA)) out[k] = def.default;
  for (const r of rows) out[r.key] = r.is_secret ? decrypt(r.value) : r.value;
  cache = out;
  return out;
}

export async function getPublicSettings() {
  const all = await getAllSettings();
  const out = {};
  for (const [k, def] of Object.entries(SETTINGS_SCHEMA)) if (def.public) out[k] = all[k];
  return out;
}

/** Admin view: every key, secrets masked. */
export async function getAdminSettings() {
  const all = await getAllSettings();
  const out = {};
  for (const [k, def] of Object.entries(SETTINGS_SCHEMA)) {
    if (def.secret) {
      const v = all[k] || '';
      out[k] = '';
      out[`${k}_set`] = Boolean(v);
      out[`${k}_hint`] = v ? `••••••••${v.slice(-4)}` : '';
    } else {
      out[k] = all[k] ?? '';
    }
  }
  return out;
}

export async function updateSettings(patch) {
  for (const [k, v] of Object.entries(patch)) {
    const def = SETTINGS_SCHEMA[k];
    if (!def) continue;
    // Empty secret = "keep existing value" so the masked field can be left blank.
    if (def.secret && (v === undefined || v === null || v === '')) continue;
    const value = def.secret ? encrypt(String(v)) : String(v ?? '');
    await col('website_settings').updateOne(
      { key: k },
      { $set: { value, is_secret: Boolean(def.secret), updated_at: new Date() } },
      { upsert: true },
    );
  }
  invalidateSettings();
}

export async function clearSecret(key) {
  if (!SETTINGS_SCHEMA[key]?.secret) return;
  await col('website_settings').deleteOne({ key });
  invalidateSettings();
}

export async function getLowStockThreshold() {
  const all = await getAllSettings();
  const n = parseInt(all.low_stock_threshold, 10);
  return Number.isFinite(n) && n >= 0 ? n : 5;
}
