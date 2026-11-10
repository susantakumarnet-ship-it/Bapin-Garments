import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query, one } from '../../db/index.js';
import { ah, validate, HttpError } from '../../utils/helpers.js';
import { passwordSchema } from '../auth.js';

const router = Router();

const roles = z.enum(['super_admin', 'admin', 'staff']);

router.get(
  '/',
  ah(async (_req, res) => {
    res.json(
      await query(
        'SELECT id, name, username, email, role, is_active, last_login_at, created_at FROM admin_users ORDER BY created_at',
      ),
    );
  }),
);

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
    const hash = await bcrypt.hash(d.password, 12);
    const row = await one(
      `INSERT INTO admin_users (name, username, email, role, password_hash) VALUES ($1,$2,LOWER($3),$4,$5)
       RETURNING id, name, username, email, role, is_active, created_at`,
      [d.name, d.username, d.email, d.role, hash],
    );
    res.status(201).json(row);
  }),
);

async function activeSuperAdmins(excludeId) {
  const r = await one("SELECT COUNT(*)::int AS n FROM admin_users WHERE role = 'super_admin' AND is_active AND id <> $1", [excludeId]);
  return r.n;
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
    const cur = await one('SELECT * FROM admin_users WHERE id = $1', [id]);
    if (!cur) throw new HttpError(404, 'User not found');
    if (id === req.user.id && (d.role !== cur.role || !d.is_active)) {
      throw new HttpError(400, 'You cannot change your own role or disable your own account');
    }
    if (cur.role === 'super_admin' && (d.role !== 'super_admin' || !d.is_active) && (await activeSuperAdmins(id)) === 0) {
      throw new HttpError(400, 'At least one active Super Admin is required');
    }
    // Bump updated_at (which invalidates existing sessions) only for security-relevant changes.
    const securityChange = Boolean(d.password) || d.role !== cur.role || d.is_active !== cur.is_active;
    const hash = d.password ? await bcrypt.hash(d.password, 12) : null;
    const row = await one(
      `UPDATE admin_users SET name=$2, email=LOWER($3), role=$4, is_active=$5,
         password_hash = COALESCE($6, password_hash),
         updated_at = CASE WHEN $7::boolean THEN NOW() ELSE updated_at END
       WHERE id=$1 RETURNING id, name, username, email, role, is_active, last_login_at, created_at`,
      [id, d.name, d.email, d.role, d.is_active, hash, securityChange],
    );
    res.json(row);
  }),
);

router.delete(
  '/:id',
  ah(async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user.id) throw new HttpError(400, 'You cannot delete your own account');
    const cur = await one('SELECT role FROM admin_users WHERE id = $1', [id]);
    if (!cur) throw new HttpError(404, 'User not found');
    if (cur.role === 'super_admin' && (await activeSuperAdmins(id)) === 0) throw new HttpError(400, 'At least one active Super Admin is required');
    await query('DELETE FROM admin_users WHERE id = $1', [id]);
    res.json({ ok: true });
  }),
);

export default router;
