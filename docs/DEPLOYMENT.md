# Deployment Guide

The app deploys as **one Node.js service**: Express serves the REST API and the built React site. You also need a **PostgreSQL** database and, ideally, **Cloudinary** for images.

## Production checklist

- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` points at managed PostgreSQL (`DATABASE_SSL=true` if the provider needs SSL)
- [ ] `JWT_SECRET` and `ENCRYPTION_KEY` set to long random values, which must **never change** afterwards: changing `ENCRYPTION_KEY` makes saved WhatsApp tokens unreadable
- [ ] `PUBLIC_SITE_URL` and `CORS_ORIGINS` set to your real domain, e.g. `https://bapingarments.com`
- [ ] `CLOUDINARY_URL` set (local `uploads/` disappears on most cloud hosts after redeploys)
- [ ] `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` set ([WHATSAPP_SETUP.md](WHATSAPP_SETUP.md))
- [ ] `SMTP_*` set so password-reset emails are delivered
- [ ] HTTPS enabled (required for the secure session cookie)
- [ ] Default passwords changed after first login
- [ ] Daily database backups scheduled

## Option A: Render / Railway / similar (recommended)

1. Push the project to a GitHub repository.
2. Create a **PostgreSQL** database (Render Postgres, Railway Postgres, Neon, Supabase or AWS RDS) and copy its connection string.
3. Create a **Web Service** from the repo:
   - **Build command:** `npm run install:all && npm run build`
   - **Start command:** `npm start`
   - **Environment:** every variable from the checklist above
4. Deploy. The first boot creates the tables and the admin account from the `SEED_ADMIN_*` variables, and loads the sample catalogue. To start with an empty catalogue, delete the sample products from the admin panel, or run `npm run seed:reset` locally against the database and then remove the products you don't need.
5. Point your domain at the service and turn on HTTPS.

## Option B: Docker (VPS / AWS EC2 / Lightsail / DigitalOcean)

```bash
cp server/.env.example .env        # fill in secrets; DATABASE_URL is set by compose
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)" >> .env
docker compose up -d --build
```

Put Nginx or Caddy in front for HTTPS. Example Caddyfile:

```
bapingarments.com {
  reverse_proxy localhost:4000
}
```

## Option C: Plain VPS with PM2

```bash
npm run install:all && npm run build
npm i -g pm2
pm2 start "npm start" --name bapin
pm2 save && pm2 startup
```

## Option D: Frontend on Vercel, API elsewhere

The API needs a long-running Node server, so host it on Render, Railway or a VPS (options A–C), and host `client/` on Vercel:

1. Vercel project root: `client`, build command `npm run build`, output `dist`.
2. Add `client/vercel.json`:
   ```json
   {
     "rewrites": [
       { "source": "/api/(.*)", "destination": "https://api.bapingarments.com/api/$1" },
       { "source": "/uploads/(.*)", "destination": "https://api.bapingarments.com/uploads/$1" },
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
   With rewrites, the browser sees a single origin, so the SameSite=Strict session cookie keeps working.

## Database backups

- **Managed Postgres:** turn on the provider's automated daily backups and point-in-time recovery.
- **Self-hosted:** schedule `npm run backup` (uses `pg_dump`, keeps the latest 30 dumps in `server/backups/`):
  ```cron
  30 2 * * * cd /srv/bapin && npm run backup >> /var/log/bapin-backup.log 2>&1
  ```
  Copy `server/backups/` to off-site storage (e.g. S3) as well.
- **Restore:** `psql "$DATABASE_URL" -f server/backups/bapin-YYYY-MM-DD-HH-MM.sql`
- **Embedded dev database:** stop the dev server before running `npm run backup`, because PGlite allows only one process at a time.

## Updating

```bash
git pull
npm run install:all && npm run build
pm2 restart bapin      # or redeploy / docker compose up -d --build
```

The schema uses `CREATE TABLE IF NOT EXISTS` and is applied on every start. Data is never dropped automatically.
