import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(__dirname, '..');

const isProd = process.env.NODE_ENV === 'production';
// Render injects the service's public URL; use it when PUBLIC_SITE_URL / CORS_ORIGINS aren't set.
const hostUrl = process.env.RENDER_EXTERNAL_URL || '';

const jwtSecret = process.env.JWT_SECRET || (isProd ? null : 'dev-only-insecure-jwt-secret-change-me');
if (!jwtSecret) {
  console.error('FATAL: JWT_SECRET must be set in production.');
  process.exit(1);
}

export const config = {
  isProd,
  port: Number(process.env.PORT) || 4000,
  databaseUrl: process.env.DATABASE_URL || '',
  databaseSsl: process.env.DATABASE_SSL === 'true',
  pgliteDir: path.resolve(SERVER_ROOT, process.env.PGLITE_DIR || 'data/pglite'),
  jwtSecret,
  // Used to encrypt secrets (e.g. WhatsApp token) stored in the database.
  encryptionKey: process.env.ENCRYPTION_KEY || jwtSecret,
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
