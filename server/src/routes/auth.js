import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { col, NO_ID, exactRegex } from '../db/index.js';
import { ah, validate, HttpError } from '../utils/helpers.js';
import { AUTH_COOKIE, cookieOptions, permissionsFor, requireAuth, signToken } from '../middleware/auth.js';
import { loginLimiter, passwordResetLimiter } from '../middleware/security.js';
import { randomToken, sha256 } from '../services/crypto.js';
import { sendMail } from '../services/mailer.js';
import { config } from '../config.js';

const router = Router();

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  username: u.username,
  email: u.email,
  role: u.role,
  permissions: permissionsFor(u.role),
});

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const users = () => col('admin_users');
const ci = exactRegex;

router.post(
  '/login',
  loginLimiter,
  ah(async (req, res) => {
    const { identifier, password } = validate(
      z.object({ identifier: z.string().trim().min(1, 'Enter username or email').max(160), password: z.string().min(1).max(128) }),
      req.body,
    );
    const user = await users().findOne({ $or: [{ username: ci(identifier) }, { email: ci(identifier) }] }, NO_ID);
    const genericError = new HttpError(401, 'Invalid username/email or password');

    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH); // equalise response time for unknown users
      throw genericError;
    }
    if (!user.is_active) throw new HttpError(403, 'This account has been disabled');
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new HttpError(423, 'Account temporarily locked after failed attempts. Try again later.');
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      const failed = user.failed_logins + 1;
      const lock = failed >= MAX_FAILED;
      await users().updateOne(
        { id: user.id },
        { $set: { failed_logins: lock ? 0 : failed, locked_until: lock ? new Date(Date.now() + LOCK_MINUTES * 60000) : null } },
      );
      throw genericError;
    }
    await users().updateOne({ id: user.id }, { $set: { failed_logins: 0, locked_until: null, last_login_at: new Date() } });
    res.cookie(AUTH_COOKIE, signToken(user), cookieOptions());
    res.json({ user: publicUser(user) });
  }),
);

router.post('/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { ...cookieOptions(), maxAge: undefined });
  res.json({ ok: true });
});

router.get(
  '/me',
  requireAuth,
  ah(async (req, res) => res.json({ user: publicUser(req.user) })),
);

router.post(
  '/forgot-password',
  passwordResetLimiter,
  ah(async (req, res) => {
    const { email } = validate(z.object({ email: z.string().trim().email('Enter a valid email') }), req.body);
    const user = await users().findOne({ email: ci(email) }, NO_ID);
    if (user && user.is_active) {
      const token = randomToken(32);
      await users().updateOne(
        { id: user.id },
        { $set: { reset_token_hash: sha256(token), reset_token_expires: new Date(Date.now() + 30 * 60000) } },
      );
      const link = `${config.publicSiteUrl}/admin/reset-password?token=${token}`;
      await sendMail({
        to: user.email,
        subject: 'Reset your Bapin Garments admin password',
        text: `Hello ${user.name},\n\nUse the link below to reset your password. It expires in 30 minutes.\n\n${link}\n\nIf you did not request this, you can ignore this email.`,
      });
    }
    // Same response whether or not the email exists (prevents account enumeration).
    res.json({ ok: true, message: 'If that email is registered, a reset link has been sent.' });
  }),
);

router.post(
  '/reset-password',
  passwordResetLimiter,
  ah(async (req, res) => {
    const { token, password } = validate(z.object({ token: z.string().min(20).max(200), password: passwordSchema }), req.body);
    const user = await users().findOne({ reset_token_hash: sha256(token), reset_token_expires: { $gt: new Date() }, is_active: true });
    if (!user) throw new HttpError(400, 'This reset link is invalid or has expired');
    const hash = await bcrypt.hash(password, 12);
    await users().updateOne(
      { id: user.id },
      {
        $set: {
          password_hash: hash,
          reset_token_hash: null,
          reset_token_expires: null,
          failed_logins: 0,
          locked_until: null,
          updated_at: new Date(),
        },
      },
    );
    res.json({ ok: true, message: 'Password updated. You can now log in.' });
  }),
);

router.post(
  '/change-password',
  requireAuth,
  ah(async (req, res) => {
    const { current_password, new_password } = validate(
      z.object({ current_password: z.string().min(1), new_password: passwordSchema }),
      req.body,
    );
    const user = await users().findOne({ id: req.user.id }, NO_ID);
    if (!(await bcrypt.compare(current_password, user.password_hash))) throw new HttpError(400, 'Current password is incorrect');
    const hash = await bcrypt.hash(new_password, 12);
    const updated = await users().findOneAndUpdate(
      { id: user.id },
      { $set: { password_hash: hash, updated_at: new Date() } },
      { returnDocument: 'after', ...NO_ID },
    );
    res.cookie(AUTH_COOKIE, signToken(updated), cookieOptions());
    res.json({ ok: true, message: 'Password changed successfully' });
  }),
);

export default router;
