# BAPIN GARMENTS — *Your Style, Your Choice!*

A complete clothing-store website with a customer storefront and an admin portal for products, size- and colour-wise inventory, customer enquiries, reports and WhatsApp notifications.

| | |
|---|---|
| **Frontend** | React 19 + Vite, Tailwind CSS v4, React Router, Recharts |
| **Backend** | Node.js + Express REST API |
| **Database** | MongoDB (MongoDB Atlas or a local server) |
| **Images** | Local disk, or Cloudinary when `CLOUDINARY_URL` is set |
| **WhatsApp** | WhatsApp Business Cloud API (Meta Graph API), server-side only |
| **Reports** | Excel (`exceljs`) and PDF (`pdfkit`) |

---

## Quick start (development)

Requires **Node.js 20 or newer**.

```bash
npm run install:all          # installs root, server and client dependencies
cp server/.env.example server/.env   # (Windows: copy server\.env.example server\.env)
npm run dev                  # API on :4000, website on :5173
```

Open **http://localhost:5173**. Admin portal: **http://localhost:5173/admin**

The first start creates the database and loads sample data (29 categories, 38 products, 259 size/colour variants with stock history, 14 enquiries).

| Role | Username | Password |
|---|---|---|
| Super Admin | `admin` | `Admin@123` |
| Staff | `staff` | `Staff@123` |

> Change these passwords right after your first login (top-right key icon → *Change Password*).

To wipe the data and load the samples again: `npm run seed:reset`

## Production (single server)

```bash
npm run build     # builds the React app into client/dist
npm start         # Express serves the API and the built website on PORT (default 4000)
```

To run with Docker, use `docker compose up -d --build` (MongoDB + app). See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Features

### Storefront
- Home page: promotional slider, perks strip, shop by category, featured collections, latest arrivals, offers, trending, best sellers, featured products, testimonials, store map and contact details
- Navigation: Home · Men · Women · Kids · New Arrivals · Offers · About Us · Contact Us, plus mega-menus and a Collections menu
- Search by product name, category, SKU or fabric
- Shop pages with filters for sub-category, size, colour, price band and in-stock only, plus sorting and pagination
- Product page: image gallery with zoom, SKU, category, description, fabric, MRP, discount price and %, colour and size selectors with live per-variant stock, status labels (New / Featured / Best Seller / Trending), and a details table
- WhatsApp: floating chat button on every page, product enquiry buttons that send the product name, code, size, colour, price and URL, and a store click-to-chat link
- Contact/enquiry form (name, mobile, optional email, subject, product, message). Enquiries are saved to the database and the owner is alerted on WhatsApp.
- Fully responsive for mobile, tablet and desktop

### Admin portal
- Secure login, password reset by email link, change password, account lockout after 5 failed attempts
- Role-based access: Super Admin, Admin and Staff
- **Dashboard:** 8 summary cards; charts for category stock, availability, monthly additions, monthly stock in/out, most viewed, most enquired and a 30-day enquiry trend; low-stock alerts; recent enquiries. Filters for category, product, stock status and date range.
- **Products:** add, edit and delete products; upload multiple images or add them by URL; set the main image; quick price updates; labels and visibility
- **Inventory:** stock is tracked per size **and** per colour. You can record Stock In, Stock Out and exact adjustments with a reason and reference, and every change goes into the stock history audit trail. Status (In Stock / Low Stock / Out of Stock) updates automatically, with a store-wide threshold that each product can override.
- **Categories:** add, edit and delete categories in a two-level tree
- **Enquiries:** search, filter by status or date, view details, change status (New / Contacted / Pending / Closed), add internal remarks, and contact the customer on WhatsApp or by phone
- **Reports:** 7 reports, each with a preview and Excel/PDF export
- **Settings:** store info (address, phone, WhatsApp, email, map, hours, social links), stock threshold, WhatsApp API credentials (stored encrypted), notification preferences and a test message
- **WhatsApp logs** and **admin user management**

---

## Project structure

```
BAPIN GARMENTS/
├── client/                 React storefront + admin portal (Vite)
│   └── src/
│       ├── pages/          Home, Shop, ProductDetail, About, Contact
│       ├── components/     Header, Footer, ProductCard, EnquiryForm, HeroSlider...
│       ├── admin/          Dashboard, Products, ProductForm, Inventory, Enquiries, Reports, Settings...
│       ├── context/        Store settings & auth providers
│       └── lib/            API client, formatting helpers
├── server/                 Express API
│   ├── src/
│   │   ├── db/             MongoDB layer, seed data
│   │   ├── routes/         auth, public, admin/*
│   │   ├── services/       inventory, products, whatsapp, settings, storage, crypto, mailer
│   │   └── middleware/     auth/roles, rate limiting, CSRF, uploads, errors
│   └── scripts/backup.js
├── docs/                   Installation, deployment, WhatsApp setup, database, admin guide
├── Dockerfile
└── docker-compose.yml
```

## Documentation

- [Installation guide](docs/INSTALLATION.md)
- [Deployment guide](docs/DEPLOYMENT.md)
- [WhatsApp Business API setup](docs/WHATSAPP_SETUP.md)
- [Database structure](docs/DATABASE.md)
- [Admin user guide](docs/ADMIN_GUIDE.md)
- [Security overview](docs/SECURITY.md)
