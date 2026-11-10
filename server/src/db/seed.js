/**
 * Seeds the database with an admin account, the category tree, sample
 * products with size/colour-wise inventory, stock history and enquiries.
 *
 *   npm run seed           -> seed only if the database is empty
 *   npm run seed -- --reset -> DELETE all data and re-seed (destructive!)
 *
 * Documents are built in memory and written with bulk inserts, so seeding a
 * remote MongoDB Atlas cluster takes seconds rather than thousands of round trips.
 */
import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'node:url';
import { config } from '../config.js';
import { initDb, col, closeDb, COLLECTIONS } from './index.js';
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

export async function resetDatabase() {
  await Promise.all([...COLLECTIONS, 'counters'].map((name) => col(name).deleteMany({})));
}

/** Collects documents per collection, assigning sequential numeric ids. */
class Batch {
  constructor() {
    this.docs = {};
  }
  add(name, doc) {
    const list = (this.docs[name] ||= []);
    const full = { id: list.length + 1, ...doc };
    list.push(full);
    return full;
  }
  async write() {
    for (const [name, docs] of Object.entries(this.docs)) {
      if (docs.length) await col(name).insertMany(docs, { ordered: true });
      await col('counters').updateOne({ _id: name }, { $set: { seq: docs.length } }, { upsert: true });
    }
  }
}

export async function seedDatabase() {
  const rand = rng(20251110);
  const { seedAdmin } = config;
  const b = new Batch();
  const now = new Date();

  // ---- Admin users ----
  const adminBase = { is_active: true, failed_logins: 0, locked_until: null, last_login_at: null, reset_token_hash: null, reset_token_expires: null, created_at: now, updated_at: now };
  const admin = b.add('admin_users', {
    name: seedAdmin.name,
    username: seedAdmin.username,
    email: seedAdmin.email.toLowerCase(),
    password_hash: await bcrypt.hash(seedAdmin.password, 12),
    role: 'super_admin',
    ...adminBase,
  });
  b.add('admin_users', {
    name: 'Store Staff',
    username: 'staff',
    email: 'staff@bapingarments.com',
    password_hash: await bcrypt.hash('Staff@123', 12),
    role: 'staff',
    ...adminBase,
  });
  const adminId = admin.id;

  // ---- Categories ----
  const catIds = {};
  let order = 0;
  for (const parent of CATEGORIES) {
    const pc = b.add('product_categories', {
      name: parent.name,
      slug: parent.slug,
      parent_id: null,
      description: parent.description,
      image_url: parent.image,
      sort_order: order++,
      is_active: true,
      created_at: now,
      updated_at: now,
    });
    catIds[parent.slug] = pc.id;
    let childOrder = 0;
    for (const [name, slug, image] of parent.children) {
      catIds[slug] = b.add('product_categories', {
        name,
        slug,
        parent_id: pc.id,
        description: null,
        image_url: image,
        sort_order: childOrder++,
        is_active: true,
        created_at: now,
        updated_at: now,
      }).id;
    }
  }

  // ---- Products, images, variants, inventory & stock history ----
  const products = {};
  const stockEvents = [];
  for (const p of PRODUCTS) {
    const created = daysAgo(p.age, Math.floor(rand() * 10));
    const flags = Object.fromEntries(Object.values(FLAG_MAP).map((f) => [f, false]));
    for (const f of p.flags) flags[FLAG_MAP[f]] = true;

    const prod = b.add('products', {
      name: p.name,
      slug: slugify(p.name),
      sku: p.sku,
      category_id: catIds[p.cat],
      description: p.desc,
      fabric: p.fabric,
      original_price: p.mrp,
      discount_price: p.price ?? null,
      ...flags,
      is_active: true,
      low_stock_threshold: null,
      view_count: p.views,
      enquiry_count: 0,
      created_at: created,
      updated_at: created,
    });
    products[p.sku] = prod;

    for (const [i, url] of p.images.entries()) {
      b.add('product_images', { product_id: prod.id, url, storage_key: null, alt_text: p.name, sort_order: i, is_primary: i === 0, created_at: created });
    }

    for (const [colorName, hex] of p.colors) {
      for (const size of p.sizes) {
        const vsku = `${p.sku}-${size}-${colorName}`.toUpperCase().replace(/[^A-Z0-9-]+/g, '');
        const v = b.add('product_variants', { product_id: prod.id, size, color: colorName, color_hex: hex, sku: vsku, is_active: true, created_at: created });

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
        const totalOut = sales.reduce((a, c) => a + c, 0);
        const opening = Math.max(0, target + totalOut - restock);

        const events = [{ type: 'IN', qty: opening, at: created, reason: 'Opening stock' }];
        const span = Math.max(1, p.age - 1);
        sales.forEach((q) => events.push({ type: 'OUT', qty: q, at: daysAgo(Math.floor(rand() * span), rand() * 8), reason: 'Counter sale' }));
        if (restock) events.push({ type: 'IN', qty: restock, at: daysAgo(Math.floor(rand() * span), 2), reason: 'Restock from supplier', ref: `PO-${1000 + Math.floor(rand() * 900)}` });
        events.sort((a, c) => a.at - c.at);

        // Walk events in date order; guard against going negative.
        const label = `${size} / ${colorName}`;
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
          stockEvents.push({ product_id: prod.id, variant_id: v.id, variant_label: label, type: e.type, quantity: e.qty, balance_after: bal, reason: e.reason, reference: e.ref || null, admin_user_id: adminId, created_at: e.at });
        }
        // Reconcile to target with an adjustment if the walk diverged.
        if (bal !== target) {
          stockEvents.push({ product_id: prod.id, variant_id: v.id, variant_label: label, type: 'ADJUST', quantity: target - bal, balance_after: target, reason: 'Stock audit correction', reference: null, admin_user_id: adminId, created_at: daysAgo(0, 1) });
        }
        b.add('inventory', { variant_id: v.id, quantity: target, updated_at: now });
      }
    }
  }
  // Ids follow creation order, like the SQL version.
  stockEvents.forEach((e) => b.add('stock_transactions', e));

  // ---- Customers & enquiries ----
  const customers = new Map();
  for (const e of ENQUIRIES) {
    const created = daysAgo(e.days, Math.floor(rand() * 9));
    let cust = customers.get(e.mobile);
    if (cust) cust.name = e.name;
    else {
      cust = b.add('customers', { name: e.name, mobile: e.mobile, email: e.email || null, whatsapp_consent: true, created_at: created, updated_at: created });
      customers.set(e.mobile, cust);
    }
    const prod = e.sku ? products[e.sku] : null;
    const enq = b.add('customer_enquiries', {
      customer_id: cust.id,
      name: e.name,
      mobile: e.mobile,
      email: e.email || null,
      subject: e.subject,
      product_id: prod?.id ?? null,
      product_name: prod ? `${prod.name} (${prod.sku})` : null,
      message: e.message,
      status: e.status,
      internal_remarks: e.remarks || null,
      source: prod ? 'product_page' : 'contact_form',
      ip_address: null,
      created_at: created,
      updated_at: created,
    });
    if (prod) prod.enquiry_count += 1;
    b.add('whatsapp_notification_logs', {
      enquiry_id: enq.id,
      to_number: '919876543210',
      message: `New enquiry from ${e.name}`,
      template_name: null,
      status: 'skipped',
      provider_message_id: null,
      error: 'WhatsApp API credentials not configured',
      created_at: created,
    });
  }

  await b.write();

  const c = (name) => b.docs[name]?.length || 0;
  console.log(`[seed] done: ${c('product_categories')} categories, ${c('products')} products, ${c('product_variants')} variants, ${c('customer_enquiries')} enquiries`);
  console.log(`[seed] admin login -> username: ${seedAdmin.username}  password: ${config.isProd ? '(value of SEED_ADMIN_PASSWORD)' : seedAdmin.password}`);
  console.log('[seed] staff login -> username: staff  password: Staff@123');
  console.log('[seed] CHANGE THESE PASSWORDS after first login.');
}

// CLI entry point
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    await initDb();
    const reset = process.argv.includes('--reset');
    const existing = await col('admin_users').countDocuments();
    if (existing > 0 && !reset) {
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
