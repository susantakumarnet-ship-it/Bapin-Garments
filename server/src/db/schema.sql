-- =====================================================================
-- BAPIN GARMENTS - PostgreSQL schema
-- Idempotent: safe to run on every start (CREATE ... IF NOT EXISTS).
-- =====================================================================

CREATE TABLE IF NOT EXISTS admin_users (
  id                  SERIAL PRIMARY KEY,
  name                VARCHAR(120) NOT NULL,
  username            VARCHAR(60)  NOT NULL UNIQUE,
  email               VARCHAR(160) NOT NULL UNIQUE,
  password_hash       VARCHAR(255) NOT NULL,
  role                VARCHAR(20)  NOT NULL DEFAULT 'staff'
                      CHECK (role IN ('super_admin', 'admin', 'staff')),
  is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
  failed_logins       INTEGER      NOT NULL DEFAULT 0,
  locked_until        TIMESTAMPTZ,
  last_login_at       TIMESTAMPTZ,
  reset_token_hash    VARCHAR(128),
  reset_token_expires TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  mobile      VARCHAR(20)  NOT NULL UNIQUE,
  email       VARCHAR(160),
  whatsapp_consent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(120) NOT NULL UNIQUE,
  parent_id   INTEGER REFERENCES product_categories(id) ON DELETE RESTRICT,
  description TEXT,
  image_url   TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON product_categories(parent_id);

CREATE TABLE IF NOT EXISTS products (
  id                  SERIAL PRIMARY KEY,
  name                VARCHAR(200) NOT NULL,
  slug                VARCHAR(220) NOT NULL UNIQUE,
  sku                 VARCHAR(60)  NOT NULL UNIQUE,
  category_id         INTEGER NOT NULL REFERENCES product_categories(id) ON DELETE RESTRICT,
  description         TEXT,
  fabric              VARCHAR(200),
  original_price      NUMERIC(10,2) NOT NULL CHECK (original_price >= 0),
  discount_price      NUMERIC(10,2) CHECK (discount_price >= 0),
  is_new_arrival      BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured         BOOLEAN NOT NULL DEFAULT FALSE,
  is_best_seller      BOOLEAN NOT NULL DEFAULT FALSE,
  is_trending         BOOLEAN NOT NULL DEFAULT FALSE,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  low_stock_threshold INTEGER CHECK (low_stock_threshold >= 0),
  view_count          INTEGER NOT NULL DEFAULT 0,
  enquiry_count       INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at);

CREATE TABLE IF NOT EXISTS product_images (
  id          SERIAL PRIMARY KEY,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  storage_key TEXT,
  alt_text    VARCHAR(200),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_images_product ON product_images(product_id);

CREATE TABLE IF NOT EXISTS product_variants (
  id          SERIAL PRIMARY KEY,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size        VARCHAR(20) NOT NULL,
  color       VARCHAR(40) NOT NULL,
  color_hex   VARCHAR(9),
  sku         VARCHAR(80) NOT NULL UNIQUE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, size, color)
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);

CREATE TABLE IF NOT EXISTS inventory (
  id          SERIAL PRIMARY KEY,
  variant_id  INTEGER NOT NULL UNIQUE REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_transactions (
  id             SERIAL PRIMARY KEY,
  product_id     INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id     INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
  variant_label  VARCHAR(80),
  type           VARCHAR(10) NOT NULL CHECK (type IN ('IN', 'OUT', 'ADJUST')),
  quantity       INTEGER NOT NULL,
  balance_after  INTEGER NOT NULL,
  reason         VARCHAR(200),
  reference      VARCHAR(100),
  admin_user_id  INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stocktx_product ON stock_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_stocktx_created ON stock_transactions(created_at);

CREATE TABLE IF NOT EXISTS customer_enquiries (
  id               SERIAL PRIMARY KEY,
  customer_id      INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  name             VARCHAR(120) NOT NULL,
  mobile           VARCHAR(20)  NOT NULL,
  email            VARCHAR(160),
  subject          VARCHAR(200) NOT NULL,
  product_id       INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name     VARCHAR(200),
  message          TEXT NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'New'
                   CHECK (status IN ('New', 'Contacted', 'Pending', 'Closed')),
  internal_remarks TEXT,
  source           VARCHAR(30) NOT NULL DEFAULT 'contact_form',
  ip_address       VARCHAR(64),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_enquiries_created ON customer_enquiries(created_at);
CREATE INDEX IF NOT EXISTS idx_enquiries_status ON customer_enquiries(status);

CREATE TABLE IF NOT EXISTS whatsapp_notification_logs (
  id                  SERIAL PRIMARY KEY,
  enquiry_id          INTEGER REFERENCES customer_enquiries(id) ON DELETE SET NULL,
  to_number           VARCHAR(20),
  message             TEXT,
  template_name       VARCHAR(100),
  status              VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  provider_message_id VARCHAR(200),
  error               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS website_settings (
  key         VARCHAR(80) PRIMARY KEY,
  value       TEXT,
  is_secret   BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
