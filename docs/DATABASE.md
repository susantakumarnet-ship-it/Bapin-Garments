# Database Structure

PostgreSQL. The full DDL is in [`server/src/db/schema.sql`](../server/src/db/schema.sql). It runs automatically on server start, and every statement is idempotent.

## Entity relationships

```
product_categories ──< product_categories (parent_id: two-level tree)
product_categories ──< products
products ──< product_images
products ──< product_variants ──1 inventory              (one stock row per size+colour)
products ──< stock_transactions >── product_variants
admin_users ──< stock_transactions                        (who made the change)
customers ──< customer_enquiries >── products
customer_enquiries ──< whatsapp_notification_logs
website_settings                                          (key/value configuration)
```

## Tables

| # | Table | Purpose | Key columns |
|---|---|---|---|
| 1 | `admin_users` | Admin portal accounts | `username`, `email` (unique), `password_hash` (bcrypt, cost 12), `role` (`super_admin` / `admin` / `staff`), `is_active`, `failed_logins`, `locked_until`, `reset_token_hash`, `reset_token_expires` |
| 2 | `customers` | One row per mobile number, created or updated from enquiries | `mobile` (unique), `name`, `email`, `whatsapp_consent` |
| 3 | `product_categories` | Category tree (Men → Shirts …) | `slug` (unique), `parent_id`, `sort_order`, `is_active`, `image_url` |
| 4 | `products` | Garment master data | `sku` (unique), `slug` (unique), `category_id`, `original_price`, `discount_price`, `fabric`, flags `is_new_arrival` / `is_featured` / `is_best_seller` / `is_trending` / `is_active`, `low_stock_threshold` (per-product override), `view_count`, `enquiry_count` |
| 5 | `product_images` | Multiple images per product | `url`, `storage_key` (local or Cloudinary id), `is_primary`, `sort_order` |
| 6 | `product_variants` | Size × colour combinations | `size`, `color`, `color_hex`, `sku` (unique); `UNIQUE(product_id, size, color)` |
| 7 | `inventory` | Current quantity per variant | `variant_id` (unique), `quantity` (`CHECK >= 0`) |
| 8 | `stock_transactions` | Audit trail of all stock movements | `type` (`IN` / `OUT` / `ADJUST`), `quantity` (positive for IN/OUT, signed delta for ADJUST), `balance_after`, `reason`, `reference`, `admin_user_id`, `created_at` |
| 9 | `customer_enquiries` | Contact-form and product enquiries | `name`, `mobile`, `email`, `subject`, `product_id`, `product_name`, `message`, `status` (`New` / `Contacted` / `Pending` / `Closed`), `internal_remarks`, `source` |
| 10 | `whatsapp_notification_logs` | Result of every WhatsApp API call | `enquiry_id`, `to_number`, `template_name`, `status` (`sent` / `failed` / `skipped`), `provider_message_id`, `error` |
| 11 | `website_settings` | Store configuration | `key`, `value`, `is_secret` (AES-256-GCM encrypted when true) |

## Stock status rules

The status is computed whenever it is read, so it can never be stale:

```
effective_threshold = products.low_stock_threshold  ??  website_settings.low_stock_threshold (default 5)
quantity <= 0                    → Out of Stock
quantity <= effective_threshold  → Low Stock
otherwise                        → In Stock
```

A product's status uses the total across its active variants. Each variant also has its own status.

## How stock changes

All changes go through one function (`services/inventory.js → applyStockMovement`). Inside a single database transaction it:

1. locks the variant row (`SELECT … FOR UPDATE`),
2. checks the movement (stock can never go negative),
3. updates `inventory.quantity`,
4. inserts a `stock_transactions` row with the new balance and the admin user.

The monthly inventory report rebuilds opening and closing balances from this ledger.

## Sample data

`server/src/db/seedData.js` (loaded by `seed.js`) provides 29 categories, 38 products across Men, Women, Kids and Collections, 259 variants with realistic stock including low and out-of-stock items, about 12 months of stock history, and 14 enquiries.
