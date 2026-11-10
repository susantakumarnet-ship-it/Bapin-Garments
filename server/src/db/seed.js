/**
 * Seeds the database with an admin account, the category tree, sample
 * products with size/colour-wise inventory, stock history and enquiries.
 *
 *   npm run seed           -> seed only if the database is empty
 *   npm run seed -- --reset -> DROP all data and re-seed (destructive!)
 */
import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'node:url';
import { config } from '../config.js';
import { initDb, query, one, transaction, closeDb } from './index.js';
import { CATEGORIES, PRODUCTS, ENQUIRIES, FLAG_MAP } from './seedData.js';
import { slugify } from '../utils/helpers.js';

// Deterministic pseudo-random generator so every seed produces the same data.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const daysAgo = (d, hourOffset = 0) => new Date(Date.now() - d * 86400000 - hourOffset * 3600000);

const TABLES = [
  'whatsapp_notification_logs', 'customer_enquiries', 'customers', 'stock_transactions', 'inventory',
  'product_variants', 'product_images', 'products', 'product_categories', 'website_settings', 'admin_users',
];

export async function resetDatabase() {
  await query(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
}

export async function seedDatabase() {
  const rand = rng(20251110);
  const { seedAdmin } = config;

  await transaction(async (tx) => {
    // ---- Admin users ----
    const { rows: adminRows } = await tx.query(
      `INSERT INTO admin_users (name, username, email, password_hash, role) VALUES ($1,$2,$3,$4,'super_admin') RETURNING id`,
      [seedAdmin.name, seedAdmin.username, seedAdmin.email.toLowerCase(), await bcrypt.hash(seedAdmin.password, 12)],
    );
    const adminId = adminRows[0].id;
    await tx.query(
      `INSERT INTO admin_users (name, username, email, password_hash, role) VALUES ($1,$2,$3,$4,'staff')`,
      ['Store Staff', 'staff', 'staff@bapingarments.com', await bcrypt.hash('Staff@123', 12)],
    );

    // ---- Categories ----
    const catIds = {};
    let order = 0;
    for (const parent of CATEGORIES) {
      const { rows } = await tx.query(
        'INSERT INTO product_categories (name, slug, description, image_url, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [parent.name, parent.slug, parent.description, parent.image, order++],
      );
      catIds[parent.slug] = rows[0].id;
      let childOrder = 0;
      for (const [name, slug, image] of parent.children) {
        const r = await tx.query(
          'INSERT INTO product_categories (name, slug, parent_id, image_url, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING id',
          [name, slug, catIds[parent.slug], image, childOrder++],
        );
        catIds[slug] = r.rows[0].id;
      }
    }

    // ---- Products, images, variants, inventory & stock history ----
    const productIds = {};
    for (const p of PRODUCTS) {
      const created = daysAgo(p.age, Math.floor(rand() * 10));
      const flags = Object.fromEntries(Object.values(FLAG_MAP).map((f) => [f, false]));
      for (const f of p.flags) flags[FLAG_MAP[f]] = true;

      const { rows } = await tx.query(
        `INSERT INTO products (name, slug, sku, category_id, description, fabric, original_price, discount_price,
           is_new_arrival, is_featured, is_best_seller, is_trending, view_count, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14) RETURNING id`,
        [p.name, slugify(p.name), p.sku, catIds[p.cat], p.desc, p.fabric, p.mrp, p.price, flags.is_new_arrival,
          flags.is_featured, flags.is_best_seller, flags.is_trending, p.views, created],
      );
      const pid = rows[0].id;
      productIds[p.sku] = pid;

      for (const [i, url] of p.images.entries()) {
        await tx.query(
          'INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary) VALUES ($1,$2,$3,$4,$5)',
          [pid, url, p.name, i, i === 0],
        );
      }

      for (const [colorName, hex] of p.colors) {
        for (const size of p.sizes) {
          const vsku = `${p.sku}-${size}-${colorName}`.toUpperCase().replace(/[^A-Z0-9-]+/g, '');
          const { rows: vr } = await tx.query(
            'INSERT INTO product_variants (product_id, size, color, color_hex, sku, created_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
            [pid, size, colorName, hex, vsku, created],
          );
          const vid = vr[0].id;

          // Target closing quantity
          let target;
          if (p.stock === 'out') target = 0;
          else if (p.stock === 'low') target = Math.floor(rand() * 3);
          else target = rand() < 0.08 ? 0 : rand() < 0.15 ? 2 + Math.floor(rand() * 3) : 6 + Math.floor(rand() * 22);

          // Generate history: opening stock, a few sales (OUT) and maybe a restock (IN).
          const sales = [];
          const nSales = Math.floor(rand() * 4) + (p.stock === 'out' ? 2 : 0);
          for (let s = 0; s < nSales; s++) sales.push(1 + Math.floor(rand() * 4));
          let restock = p.age > 60 && rand() < 0.4 ? 5 + Math.floor(rand() * 10) : 0;
          if (restock > target) restock = 0; // keeps opening >= total sales so balance never dips below zero
          const totalOut = sales.reduce((a, b) => a + b, 0);
          const opening = Math.max(0, target + totalOut - restock);

          const events = [{ type: 'IN', qty: opening, at: created, reason: 'Opening stock' }];
          const span = Math.max(1, p.age - 1);
          sales.forEach((q) => events.push({ type: 'OUT', qty: q, at: daysAgo(Math.floor(rand() * span), rand() * 8), reason: 'Counter sale' }));
          if (restock) events.push({ type: 'IN', qty: restock, at: daysAgo(Math.floor(rand() * span), 2), reason: 'Restock from supplier', ref: `PO-${1000 + Math.floor(rand() * 900)}` });
          events.sort((a, b) => a.at - b.at);

          // Walk events in date order; guard against going negative.
          let bal = 0;
          for (const e of events) {
            if (e.qty <= 0) continue;
            if (e.type === 'OUT') {
              const q = Math.min(e.qty, bal);
              if (q <= 0) continue;
              bal -= q;
              e.qty = q;
            } else {
              bal += e.qty;
            }
            await tx.query(
              `INSERT INTO stock_transactions (product_id, variant_id, variant_label, type, quantity, balance_after, reason, reference, admin_user_id, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
              [pid, vid, `${size} / ${colorName}`, e.type, e.qty, bal, e.reason, e.ref || null, adminId, e.at],
            );
          }
          // Reconcile to target with an adjustment if the walk diverged.
          if (bal !== target) {
            await tx.query(
              `INSERT INTO stock_transactions (product_id, variant_id, variant_label, type, quantity, balance_after, reason, admin_user_id, created_at)
               VALUES ($1,$2,$3,'ADJUST',$4,$5,'Stock audit correction',$6,$7)`,
              [pid, vid, `${size} / ${colorName}`, target - bal, target, adminId, daysAgo(0, 1)],
            );
          }
          await tx.query('INSERT INTO inventory (variant_id, quantity) VALUES ($1,$2)', [vid, target]);
        }
      }
    }

    // ---- Customers & enquiries ----
    for (const e of ENQUIRIES) {
      const created = daysAgo(e.days, Math.floor(rand() * 9));
      const { rows: c } = await tx.query(
        `INSERT INTO customers (name, mobile, email, whatsapp_consent, created_at) VALUES ($1,$2,$3,TRUE,$4)
         ON CONFLICT (mobile) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [e.name, e.mobile, e.email || null, created],
      );
      const pid = e.sku ? productIds[e.sku] : null;
      const prod = PRODUCTS.find((p) => p.sku === e.sku);
      const { rows: er } = await tx.query(
        `INSERT INTO customer_enquiries (customer_id, name, mobile, email, subject, product_id, product_name, message, status, internal_remarks, source, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) RETURNING id`,
        [c[0].id, e.name, e.mobile, e.email || null, e.subject, pid, prod ? `${prod.name} (${prod.sku})` : null, e.message,
          e.status, e.remarks || null, pid ? 'product_page' : 'contact_form', created],
      );
      if (pid) await tx.query('UPDATE products SET enquiry_count = enquiry_count + 1 WHERE id = $1', [pid]);
      await tx.query(
        `INSERT INTO whatsapp_notification_logs (enquiry_id, to_number, message, status, error, created_at)
         VALUES ($1, '919876543210', $2, 'skipped', 'WhatsApp API credentials not configured', $3)`,
        [er[0].id, `New enquiry from ${e.name}`, created],
      );
    }
  });

  const counts = await one(
    `SELECT (SELECT COUNT(*) FROM products)::int AS products, (SELECT COUNT(*) FROM product_variants)::int AS variants,
            (SELECT COUNT(*) FROM product_categories)::int AS categories, (SELECT COUNT(*) FROM customer_enquiries)::int AS enquiries`,
  );
  console.log(`[seed] done: ${counts.categories} categories, ${counts.products} products, ${counts.variants} variants, ${counts.enquiries} enquiries`);
  console.log(`[seed] admin login -> username: ${seedAdmin.username}  password: ${seedAdmin.password}`);
  console.log('[seed] staff login -> username: staff  password: Staff@123');
  console.log('[seed] CHANGE THESE PASSWORDS after first login.');
}

// CLI entry point
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    await initDb();
    const reset = process.argv.includes('--reset');
    const existing = await one('SELECT COUNT(*)::int AS n FROM admin_users');
    if (existing.n > 0 && !reset) {
      console.log('[seed] database already has data. Use `npm run seed -- --reset` to wipe and re-seed.');
    } else {
      if (reset) {
        console.log('[seed] resetting database...');
        await resetDatabase();
      }
      await seedDatabase();
    }
    await closeDb();
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
