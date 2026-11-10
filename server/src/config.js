import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(__dirname, '..');

const isProd = process.env.NODE_ENV === 'production';
// Render injects the service's public URL; use it when PUBLIC_SITE_URL / CORS_ORIGINS aren't set.
/**
 * MongoDB connection string from MONGODB_URI (or DATABASE_URL). Passwords pasted
 * from Atlas often contain characters such as @ that must be URL-encoded; fix that
 * here so a raw password still works.
 */
function normaliseMongoUri(raw) {
  const uri = String(raw || '').trim();
  const m = uri.match(/^(mongodb(?:\+srv)?:\/\/)([^/?#]*)@([^@]*)$/);
  if (!m) return uri;
  const [, scheme, userinfo, rest] = m;
  const i = userinfo.indexOf(':');
  const enc = (v) => {
    let decoded = v;
    try {
      decoded = decodeURIComponent(v);
    } catch {
      /* keep raw */
    }
    return encodeURIComponent(decoded);
  };
  const fixed = i < 0 ? enc(userinfo) : `${enc(userinfo.slice(0, i))}:${enc(userinfo.slice(i + 1))}`;
  return `${scheme}${fixed}@${rest}`;
}
const dbNameFromUri = (uri) => uri.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/)?.[1] || '';
const mongoUri = normaliseMongoUri(
  process.env.MONGODB_URI || (/^mongodb/.test(process.env.DATABASE_URL || '') ? process.env.DATABASE_URL : ''),
);

const hostUrl = process.env.RENDER_EXTERNAL_URL || '';

// In production, missing secrets are generated once and stored in the database
// (see ensureSecrets in db/index.js). Environment variables always take priority.
const devSecret = isProd ? '' : 'dev-only-insecure-jwt-secret-change-me';
const jwtSecret = process.env.JWT_SECRET || devSecret;

export const config = {
  isProd,
  port: Number(process.env.PORT) || 4000,
  mongoUri,
  mongoDbName: process.env.MONGODB_DB || dbNameFromUri(mongoUri) || 'BapinGarments',
  jwtSecret,
  // Used to encrypt secrets (e.g. WhatsApp token) stored in the database.
  encryptionKey: process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || devSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  publicSiteUrl: (process.env.PUBLIC_SITE_URL || hostUrl || 'http://localhost:5173').replace(/\/$/, ''),
  corsOrigins: (process.env.CORS_ORIGINS || hostUrl || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  uploadDir: path.resolve(SERVER_ROOT, process.env.UPLOAD_DIR || 'uploads'),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB) || 5,
  cloudinaryUrl: process.env.CLOUDINARY_URL || '',
  whatsapp: {
    // Environment variables take priority over values saved in admin settings.
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'Bapin Garments <no-reply@bapingarments.com>',
  },
  seedAdmin: {
    name: process.env.SEED_ADMIN_NAME || 'Store Owner',
    username: process.env.SEED_ADMIN_USERNAME || 'admin',
    email: process.env.SEED_ADMIN_EMAIL || 'admin@bapingarments.com',
    password: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
  },
  clientDist: path.resolve(SERVER_ROOT, '../client/dist'),
};
