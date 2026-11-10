import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { col, insert, exactRegex } from '../../db/index.js';
import { ah, validate, HttpError } from '../../utils/helpers.js';
import { passwordSchema } from '../auth.js';

const router = Router();

const roles = z.enum(['super_admin', 'admin', 'staff']);
const users = () => col('admin_users');
const LIST_FIELDS = { _id: 0, id: 1, name: 1, username: 1, email: 1, role: 1, is_active: 1, last_login_at: 1, created_at: 1 };
const pick = (u) => Object.fromEntries(Object.keys(LIST_FIELDS).filter((k) => k !== '_id').map((k) => [k, u[k] ?? null]));

router.get(
  '/',
  ah(async (_req, res) => {
    res.json(await users().find({}, { projection: LIST_FIELDS }).sort({ created_at: 1, id: 1 }).toArray());
  }),
);

async function assertUnique({ username, email }, excludeId) {
  const not = excludeId ? { id: { $ne: excludeId } } : {};
  if (username && (await users().findOne({ username: exactRegex(username), ...not }))) {
    throw new HttpError(409, 'A record with this username already exists');
  }
  if (email && (await users().findOne({ email: exactRegex(email), ...not }))) {
    throw new HttpError(409, 'A record with this email already exists');
  }
}

router.post(
  '/',
  ah(async (req, res) => {
    const d = validate(
      z.object({
        name: z.string().trim().min(2).max(120),
        username: z.string().trim().min(3).max(60).regex(/^[a-zA-Z0-9._-]+$/, 'Letters, numbers, . _ - only'),
        email: z.string().trim().email().max(160),
        role: roles,
        password: passwordSchema,
      }),
      req.body,
    );
    await assertUnique(d);
    const now = new Date();
    const row = await insert('admin_users', {
      name: d.name,
      username: d.username,
      email: d.email.toLowerCase(),
      password_hash: await bcrypt.hash(d.password, 12),
      role: d.role,
      is_active: true,
      failed_logins: 0,
      locked_until: null,
      last_login_at: null,
      reset_token_hash: null,
      reset_token_expires: null,
      created_at: now,
      updated_at: now,
    });
    const { last_login_at, ...out } = pick(row);
    res.status(201).json(out);
  }),
);

async function activeSuperAdmins(excludeId) {
  return users().countDocuments({ role: 'super_admin', is_active: true, id: { $ne: excludeId } });
}

router.put(
  '/:id',
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const d = validate(
      z.object({
        name: z.string().trim().min(2).max(120),
        email: z.string().trim().email().max(160),
        role: roles,
        is_active: z.boolean(),
        password: z.union([z.literal(''), passwordSchema]).optional(),
      }),
      req.body,
    );
    const cur = await users().findOne({ id });
    if (!cur) throw new HttpError(404, 'User not found');
    if (id === req.user.id && (d.role !== cur.role || !d.is_active)) {
      throw new HttpError(400, 'You cannot change your own role or disable your own account');
    }
    if (cur.role === 'super_admin' && (d.role !== 'super_admin' || !d.is_active) && (await activeSuperAdmins(id)) === 0) {
      throw new HttpError(400, 'At least one active Super Admin is required');
    }
    await assertUnique({ email: d.email }, id);
    // Bump updated_at (which invalidates existing sessions) only for security-relevant changes.
    const securityChange = Boolean(d.password) || d.role !== cur.role || d.is_active !== cur.is_active;
    const set = { name: d.name, email: d.email.toLowerCase(), role: d.role, is_active: d.is_active };
    if (d.password) set.password_hash = await bcrypt.hash(d.password, 12);
    if (securityChange) set.updated_at = new Date();
    const row = await users().findOneAndUpdate({ id }, { $set: set }, { returnDocument: 'after' });
    res.json(pick(row));
  }),
);

router.delete(
  '/:id',
  ah(async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user.id) throw new HttpError(400, 'You cannot delete your own account');
    const cur = await users().findOne({ id });
    if (!cur) throw new HttpError(404, 'User not found');
    if (cur.role === 'super_admin' && (await activeSuperAdmins(id)) === 0) throw new HttpError(400, 'At least one active Super Admin is required');
    await users().deleteOne({ id });
    await col('stock_transactions').updateMany({ admin_user_id: id }, { $set: { admin_user_id: null } });
    res.json({ ok: true });
  }),
);

export default router;
