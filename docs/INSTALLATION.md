# Installation Guide

## 1. Prerequisites

| Software | Version | Notes |
|---|---|---|
| Node.js | 20 LTS or newer | https://nodejs.org |
| Git | any | optional |
| MongoDB | 6+ | A free **MongoDB Atlas** cluster (https://cloud.mongodb.com) or a local MongoDB server. |

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
| `MONGODB_URI` | **Required.** MongoDB connection string. Atlas: *Connect → Drivers*, e.g. `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/`. Local: `mongodb://127.0.0.1:27017`. Special characters in the password must be URL-encoded (`@` → `%40`); the server also does this automatically. |
| `MONGODB_DB` | Database name (default `BapinGarments`) |
| `JWT_SECRET`, `ENCRYPTION_KEY` | Long random strings. If they're missing in production, the server generates them once and stores them in the database. To set your own, generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
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

On first start the indexes are created and, if the database has no admin users, the sample data is loaded.

## 5. Setting up MongoDB Atlas

1. Create a free cluster at https://cloud.mongodb.com.
2. **Database Access:** add a database user with a password.
3. **Network Access:** add your IP address. For hosting on Render, add `0.0.0.0/0` (allow from anywhere), because Render's outbound IPs change.
4. **Connect → Drivers:** copy the connection string into `MONGODB_URI` and replace `<password>`.

The collections, indexes and sample data are created automatically on first start.

## 6. Useful commands

| Command | Description |
|---|---|
| `npm run dev` | Run API + website with hot reload |
| `npm run build` | Build the website for production |
| `npm start` | Start the production server (serves API + built website) |
| `npm run seed` | Load sample data (only if the database is empty) |
| `npm run seed:reset` | **Erase all data** and reload the samples |
| `npm run backup` | Back up the database to `server/backups/` |
| `npm run restore -- <file> --yes` | **Replace all data** with a backup file |

## Troubleshooting

- **Port already in use:** change `PORT` in `server/.env` (and `VITE_API_PROXY` if you run the client separately).
- **`Could not connect to MongoDB`:** check the username and password in `MONGODB_URI`, and that Atlas *Network Access* allows your IP address.
- **Images not showing in admin uploads:** check that `server/uploads` is writable.
