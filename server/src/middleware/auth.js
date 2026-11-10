import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { one } from '../db/index.js';
import { HttpError } from '../utils/helpers.js';

export const AUTH_COOKIE = 'bg_admin_token';

/**
 * Role-based permissions.
 *   super_admin: everything, including managing admin users
 *   admin:       full store management (products, categories, settings, reports)
 *   staff:       day-to-day work — view products, record stock in/out, handle enquiries
 */
export const PERMISSIONS = {
  'dashboard.view': ['super_admin', 'admin', 'staff'],
  'products.view': ['super_admin', 'admin', 'staff'],
  'products.write': ['super_admin', 'admin'],
  'products.delete': ['super_admin', 'admin'],
  'categories.write': ['super_admin', 'admin'],
  'stock.write': ['super_admin', 'admin', 'staff'],
  'enquiries.view': ['super_admin', 'admin', 'staff'],
  'enquiries.write': ['super_admin', 'admin', 'staff'],
  'enquiries.delete': ['super_admin', 'admin'],
  'reports.view': ['super_admin', 'admin', 'staff'],
  'settings.view': ['super_admin', 'admin'],
  'settings.write': ['super_admin', 'admin'],
  'users.manage': ['super_admin'],
};

export function permissionsFor(role) {
  return Object.keys(PERMISSIONS).filter((p) => PERMISSIONS[p].includes(role));
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: 8 * 60 * 60 * 1000,
  };
}

/** Requires a valid admin session (JWT in an httpOnly cookie). */
export async function requireAuth(req, _res, next) {
  try {
    const token = req.cookies?.[AUTH_COOKIE];
    if (!token) throw new HttpError(401, 'Please log in');
    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch {
      throw new HttpError(401, 'Session expired. Please log in again');
    }
    const user = await one(
      'SELECT id, name, username, email, role, is_active, updated_at FROM admin_users WHERE id = $1',
      [payload.sub],
    );
    if (!user || !user.is_active) throw new HttpError(401, 'Account disabled or not found');
    // Invalidate tokens issued before a password change / role change.
    if (payload.iat * 1000 < new Date(user.updated_at).getTime() - 1000) {
      throw new HttpError(401, 'Session expired. Please log in again');
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export const can = (permission) => (req, _res, next) => {
  const roles = PERMISSIONS[permission] || [];
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new HttpError(403, 'You do not have permission to perform this action'));
  }
  next();
};
