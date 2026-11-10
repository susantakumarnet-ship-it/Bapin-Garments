# Security Overview

| Requirement | Implementation |
|---|---|
| Secure admin authentication | JWT session in an **httpOnly, SameSite=Strict** cookie (`Secure` in production). No tokens are stored in JavaScript or localStorage. Sessions expire after 8 hours. |
| Password hashing | bcrypt with cost factor 12. Passwords need 8+ characters including a letter and a number. |
| Brute-force protection | Login rate limit (10 per 15 min per IP) and account lockout for 15 minutes after 5 failed attempts. Unknown users get the same response time and message. |
| Password reset | 256-bit random token, stored only as a SHA-256 hash, expires in 30 minutes, single use. The response is identical whether or not the email exists. |
| Session invalidation | Changing a password, role or active status invalidates that user's existing sessions. |
| Role-based access | `super_admin`, `admin` and `staff` permissions are enforced **on the server** for every admin route (`middleware/auth.js`). The UI also hides actions the user can't perform. |
| Backend validation | Every request body is validated with `zod` schemas (types, lengths, formats, price rules). |
| SQL injection | Every query is parameterised (`$1, $2 …`). No user input is concatenated into SQL. |
| XSS | React escapes all output. Helmet sets a strict Content-Security-Policy, `X-Content-Type-Options` and `Referrer-Policy`. Uploaded files are served with `nosniff`. |
| CSRF | SameSite=Strict cookie, and every state-changing request must carry `X-Requested-With`. CORS only allows configured origins. |
| API security | Helmet headers, a JSON body size limit (200 KB), a generic rate limit (600 requests per 15 min), error messages hidden in production, `x-powered-by` disabled. |
| Rate limiting | Global API limit, plus stricter limits on login, password reset and enquiry submission (5 per 10 min). The enquiry form also has a honeypot field. |
| Secure image uploads | MIME allow-list **plus magic-byte check** (JPG/PNG/WEBP/GIF), 5 MB limit, at most 10 files per request, random file names, path-traversal-safe deletion, optional Cloudinary storage. |
| Credentials | All secrets come from environment variables. If `JWT_SECRET` / `ENCRYPTION_KEY` are not set in production, the server generates strong random values once and stores them in the database (`app_secrets` table), never in code. WhatsApp tokens saved from the admin panel are encrypted with **AES-256-GCM** and never returned to the browser (only a masked hint). |
| Database backups | `npm run backup` (pg_dump, keeps 30 copies). Managed-Postgres backups are recommended. See DEPLOYMENT.md. |
| Customer data protection | Customer data is reachable only through authenticated admin routes. Enquiry consent is recorded. Public product APIs leave out internal fields such as view counts and thresholds. |

## Operational recommendations

- Serve the site over HTTPS only.
- Rotate the WhatsApp system-user token if a staff member with access leaves.
- Keep dependencies updated (`npm audit`).
- Restrict database network access to the application server.
