import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { config } from '../config.js';
import { HttpError } from '../utils/helpers.js';
import { AUTH_COOKIE } from './auth.js';

const limiter = (windowMin, max, message, skip) =>
  rateLimit({
    windowMs: windowMin * 60 * 1000,
    max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: message },
    ...(skip ? { skip } : {}),
  });

/** True when the request carries a valid (signed, unexpired) admin session cookie. */
const hasAdminSession = (req) => {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) return false;
  try {
    jwt.verify(token, config.jwtSecret);
    return true;
  } catch {
    return false;
  }
};

// Signed-in staff are not counted: everyone on the shop's Wi-Fi shares one IP,
// so staff using the admin panel must not lock out customers (or each other).
export const apiLimiter = limiter(15, 600, 'Too many requests, please try again later.', hasAdminSession);
export const loginLimiter = limiter(15, 10, 'Too many login attempts. Please wait 15 minutes.');
export const passwordResetLimiter = limiter(60, 5, 'Too many reset requests. Please try again later.');
export const enquiryLimiter = limiter(10, 5, 'Too many enquiries submitted. Please try again in a few minutes.');

/**
 * CSRF protection for cookie-authenticated requests.
 * The session cookie is SameSite=Strict, and every state-changing request must
 * carry the custom `X-Requested-With` header. Browsers will not send custom
 * headers cross-origin without a CORS preflight, which our CORS policy rejects
 * for unknown origins.
 */
export function csrfGuard(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'XMLHttpRequest') {
    return next(new HttpError(403, 'Missing CSRF header'));
  }
  next();
}

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
      return cb(new HttpError(400, 'Only JPG, PNG, WEBP or GIF images are allowed'));
    }
    cb(null, true);
  },
});

export function errorHandler(err, _req, res, _next) {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? `Each image must be under ${config.maxUploadMb} MB` : err.message;
    return res.status(400).json({ error: msg });
  }
  // Unique-index violation from MongoDB.
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || {}).find((k) => k !== 'product_id') || '';
    return res.status(409).json({ error: field ? `A record with this ${field} already exists` : 'Duplicate value' });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status >= 500 && config.isProd ? 'Something went wrong' : err.message || 'Something went wrong',
    ...(err.details ? { fields: err.details } : {}),
  });
}
