/**
 * Database access layer: MongoDB (official driver).
 *
 * Set MONGODB_URI (or DATABASE_URL) to a MongoDB connection string, e.g. a
 * free MongoDB Atlas cluster. Each former SQL table is a collection with the
 * same field names. Every document also carries a numeric `id` (from the
 * `counters` collection), so URLs and API responses keep simple numeric IDs.
 *
 * User input is only ever passed as values inside query objects, never
 * evaluated, and search terms are regex-escaped (see `likeRegex`).
 */
import crypto from 'node:crypto';
import { MongoClient } from 'mongodb';
import { config } from '../config.js';

let client = null;
let db = null;

export const COLLECTIONS = [
  'admin_users',
  'customers',
  'product_categories',
  'products',
  'product_images',
  'product_variants',
  'inventory',
  'stock_transactions',
  'customer_enquiries',
  'whatsapp_notification_logs',
  'website_settings',
];

const INDEXES = {
  admin_users: [[{ username: 1 }, { unique: true }], [{ email: 1 }, { unique: true }]],
  customers: [[{ mobile: 1 }, { unique: true }]],
  product_categories: [[{ slug: 1 }, { unique: true }], [{ parent_id: 1 }]],
  products: [[{ slug: 1 }, { unique: true }], [{ sku: 1 }, { unique: true }], [{ category_id: 1 }], [{ created_at: -1 }]],
  product_images: [[{ product_id: 1 }]],
  product_variants: [[{ sku: 1 }, { unique: true }], [{ product_id: 1, size: 1, color: 1 }, { unique: true }]],
  inventory: [[{ variant_id: 1 }, { unique: true }]],
  stock_transactions: [[{ product_id: 1 }], [{ created_at: -1 }]],
  customer_enquiries: [[{ created_at: -1 }], [{ status: 1 }], [{ mobile: 1 }]],
  whatsapp_notification_logs: [[{ enquiry_id: 1 }]],
  website_settings: [[{ key: 1 }, { unique: true }]],
};

/** Collection accessor: col('products').find(...) */
export const col = (name) => {
  if (!db) throw new Error('Database not initialised');
  return db.collection(name);
};

/** Next numeric id for a collection (atomic counter). */
export async function nextId(name) {
  const r = await col('counters').findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' });
  return r.seq;
}

/** Insert a document, assigning a numeric id. Returns the stored document without _id. */
export async function insert(name, doc) {
  const full = { id: await nextId(name), ...doc };
  await col(name).insertOne(full);
  delete full._id;
  return full;
}

/** Projection that hides Mongo's internal _id. */
export const NO_ID = { projection: { _id: 0 } };

const escapeRegex = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Case-insensitive "contains" regex with user input safely escaped. */
export const likeRegex = (term) => new RegExp(escapeRegex(String(term).trim().slice(0, 80)), 'i');

/** Case-insensitive exact-match regex (like LOWER(a) = LOWER(b)). */
export const exactRegex = (value) => new RegExp(`^${escapeRegex(value)}$`, 'i');

/** Start of the given YYYY-MM-DD day (UTC); `end` gives the start of the next day. */
export function dayBound(value, end = false) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  if (end) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

/** Mongo filter for created_at between ?from and ?to (inclusive days). */
export function dateRange(from, to) {
  const range = {};
  const f = dayBound(from);
  const t = dayBound(to, true);
  if (f) range.$gte = f;
  if (t) range.$lt = t;
  return Object.keys(range).length ? range : null;
}

function resolveUri() {
  const uri = config.mongoUri;
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Add your MongoDB connection string to server/.env (see .env.example).');
  }
  if (!/^mongodb(\+srv)?:\/\//.test(uri)) {
    throw new Error('MONGODB_URI must start with mongodb:// or mongodb+srv://');
  }
  return uri;
}

export async function initDb() {
  if (db) return db;
  client = new MongoClient(resolveUri(), { serverSelectionTimeoutMS: 15000, appName: 'bapin-garments' });
  try {
    await client.connect();
  } catch (err) {
    const hint = /bad auth|authentication failed/i.test(err.message)
      ? ' (check the username/password; special characters such as @ : / must be URL-encoded, e.g. @ -> %40)'
      : /ENOTFOUND|querySrv|ETIMEOUT|timed out|Server selection/i.test(err.message)
        ? ' (check the cluster address and that Atlas "Network Access" allows this server\'s IP, or 0.0.0.0/0)'
        : '';
    throw new Error(`Could not connect to MongoDB: ${err.message}${hint}`);
  }
  db = client.db(config.mongoDbName || undefined);
  // Settings are keyed by `key`; drop a numeric-id index left by an early build.
  await col('website_settings').dropIndex('id_1').catch(() => {});
  await Promise.all(
    [...Object.entries(INDEXES)].flatMap(([name, list]) => [
      ...(name === 'website_settings' ? [] : [col(name).createIndex({ id: 1 }, { unique: true })]),
      ...list.map(([keys, opts]) => col(name).createIndex(keys, opts || {})),
    ]),
  );
  await ensureSecrets();
  console.log(`[db] connected to MongoDB database "${db.databaseName}"`);
  return db;
}

/**
 * Fill in JWT_SECRET / ENCRYPTION_KEY when they aren't set in the environment:
 * generate them once, store them in app_secrets and reuse them on every start,
 * so sessions and encrypted settings survive restarts.
 */
async function ensureSecrets() {
  const wanted = [
    ['jwt_secret', 'jwtSecret'],
    ['encryption_key', 'encryptionKey'],
  ].filter(([, prop]) => !config[prop]);
  for (const [name, prop] of wanted) {
    await col('app_secrets').updateOne(
      { _id: name },
      { $setOnInsert: { value: crypto.randomBytes(48).toString('hex'), created_at: new Date() } },
      { upsert: true },
    );
    const doc = await col('app_secrets').findOne({ _id: name });
    config[prop] = doc.value;
    console.log(`[db] ${name} not set in environment - using the value stored in the database`);
  }
}

export function closeDb() {
  const c = client;
  client = null;
  db = null;
  return c?.close();
}
