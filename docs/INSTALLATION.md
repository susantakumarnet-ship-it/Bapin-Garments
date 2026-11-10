# Installation Guide

## 1. Prerequisites

| Software | Version | Notes |
|---|---|---|
| Node.js | 20 LTS or newer | https://nodejs.org |
| Git | any | optional |
| PostgreSQL | 14+ | **Optional in development.** If `DATABASE_URL` is empty, an embedded PostgreSQL (PGlite) is used automatically. |

## 2. Install dependencies

```bash
cd "BAPIN GARMENTS"
npm run install:all
```

## 3. Configure the server

Copy the example environment file:

```bash
# macOS / Linux
cp server/.env.example server/.env
# Windows
copy server\.env.example server\.env
```

The defaults work for local development. Useful settings:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Leave empty to use embedded Postgres in `server/data/pglite`. Set it to use a real PostgreSQL server, e.g. `postgres://user:pass@localhost:5432/bapin` |
| `JWT_SECRET`, `ENCRYPTION_KEY` | Long random strings. **Required in production.** Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `SEED_ADMIN_*` | The first admin account, created on first start |
| `CLOUDINARY_URL` | Optional; stores images on Cloudinary instead of local disk |
| `SMTP_*` | Optional; sends password-reset emails. Without it, the reset link is printed in the server console. |
| `WHATSAPP_*` | Optional; see [WHATSAPP_SETUP.md](WHATSAPP_SETUP.md) |

## 4. Run

```bash
npm run dev
```

- Website: http://localhost:5173
- Admin: http://localhost:5173/admin (`admin` / `Admin@123`)
- API health check: http://localhost:4000/api/health

On first start the database tables are created from `server/src/db/schema.sql` and sample data is loaded.

## 5. Using a local PostgreSQL instead

```sql
CREATE DATABASE bapin;
CREATE USER bapin WITH PASSWORD 'strong-password';
GRANT ALL PRIVILEGES ON DATABASE bapin TO bapin;
-- PostgreSQL 15+: also run inside the bapin database
GRANT ALL ON SCHEMA public TO bapin;
```

Set `DATABASE_URL=postgres://bapin:strong-password@localhost:5432/bapin` in `server/.env` and restart. The tables and sample data are created automatically.

You can also apply the schema by hand: `psql "$DATABASE_URL" -f server/src/db/schema.sql`

## 6. Useful commands

| Command | Description |
|---|---|
| `npm run dev` | Run API + website with hot reload |
| `npm run build` | Build the website for production |
| `npm start` | Start the production server (serves API + built website) |
| `npm run seed` | Load sample data (only if the database is empty) |
| `npm run seed:reset` | **Erase all data** and reload the samples |
| `npm run backup` | Back up the database to `server/backups/` |

## Troubleshooting

- **Port already in use:** change `PORT` in `server/.env` (and `VITE_API_PROXY` if you run the client separately).
- **Embedded database errors after a crash:** stop the server, delete `server/data/pglite`, then start again. The samples are re-seeded. Development only!
- **Images not showing in admin uploads:** check that `server/uploads` is writable.
