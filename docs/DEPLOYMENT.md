# Deployment Guide

The app deploys as **one Node.js service**: Express serves the REST API and the built React site. You also need a **MongoDB** database (MongoDB Atlas recommended) and, ideally, **Cloudinary** for images.

## Production checklist

- [ ] `NODE_ENV=production`
- [ ] `MONGODB_URI` points at your MongoDB Atlas cluster, and Atlas *Network Access* allows the server (`0.0.0.0/0` for Render)
- [ ] `JWT_SECRET` and `ENCRYPTION_KEY` set to long random values, which must **never change** afterwards: changing `ENCRYPTION_KEY` makes saved WhatsApp tokens unreadable
- [ ] `PUBLIC_SITE_URL` and `CORS_ORIGINS` set to your real domain, e.g. `https://bapingarments.com`
- [ ] `CLOUDINARY_URL` set (local `uploads/` disappears on most cloud hosts after redeploys)
- [ ] `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` set ([WHATSAPP_SETUP.md](WHATSAPP_SETUP.md))
- [ ] `SMTP_*` set so password-reset emails are delivered
- [ ] HTTPS enabled (required for the secure session cookie)
- [ ] Default passwords changed after first login
- [ ] Daily database backups scheduled

## Option A1: Render Blueprint (one click)

The repo includes [`render.yaml`](../render.yaml), which creates the web service. The data lives in your MongoDB Atlas cluster.

1. In the Render dashboard, open your project and choose **New → Blueprint**, then connect the GitHub repo.
2. Render asks for the values marked `sync: false`. Fill in **MONGODB_URI** (your Atlas connection string), plus **SEED_ADMIN_EMAIL** and **SEED_ADMIN_PASSWORD** (used only if the database is empty). Leave the rest blank for now if you like. `JWT_SECRET` and `ENCRYPTION_KEY` are generated automatically.
3. Click **Apply**. The first deploy builds the site (about 3–5 minutes). On first boot against an empty database it creates the admin account and the sample catalogue.
4. Open `https://<service>.onrender.com`. The admin panel is at `/admin`.

Notes:
- `PUBLIC_SITE_URL` and `CORS_ORIGINS` default to the Render URL. Set them explicitly once you add a custom domain.
- The free plan is fine for trying it out. The free web service sleeps after 15 minutes idle (first visit then takes about a minute); upgrade before going live. The free Atlas M0 cluster does not expire.
- Render's disk is wiped on every deploy, so set **CLOUDINARY_URL** to keep uploaded product photos.

## Option A2: Render / Railway / similar (manual)

1. Push the project to a GitHub repository.
2. Create a **MongoDB Atlas** cluster, allow network access from the host (`0.0.0.0/0`), and copy its connection string.
3. Create a **Web Service** from the repo:
   - **Build command:** `npm run install:all && npm run build`
   - **Start command:** `npm start`
   - **Environment:** every variable from the checklist above
   - If the service's **Root Directory** is `server` (build command `npm install`, start command `npm start`), that also works: on Render, `npm install` in `server/` builds the website automatically. On other hosts, set `BUILD_CLIENT=true` for the same behaviour.
4. Deploy. The first boot creates the indexes and the admin account from the `SEED_ADMIN_*` variables, and loads the sample catalogue. To start with an empty catalogue, delete the sample products from the admin panel, or run `npm run seed:reset` locally against the database and then remove the products you don't need.
5. Point your domain at the service and turn on HTTPS.

## Option B: Docker (VPS / AWS EC2 / Lightsail / DigitalOcean)

```bash
cp server/.env.example .env        # fill in secrets; MONGODB_URI is set by compose
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

- **MongoDB Atlas:** paid clusters include Cloud Backup with point-in-time recovery; turn it on.
- **Any cluster (including free M0):** schedule `npm run backup` (exports every collection to a gzipped JSON file and keeps the latest 30 in `server/backups/`):
  ```cron
  30 2 * * * cd /srv/bapin && npm run backup >> /var/log/bapin-backup.log 2>&1
  ```
  Copy `server/backups/` to off-site storage (e.g. S3) as well.
- **Restore:** `npm run restore -- server/backups/bapin-YYYY-MM-DD-HH-mm.json.gz --yes` (replaces all current data; without `--yes` it only shows what the file contains).

## Updating

```bash
git pull
npm run install:all && npm run build
pm2 restart bapin      # or redeploy / docker compose up -d --build
```

Indexes are created on every start if missing. Data is never dropped automatically.
