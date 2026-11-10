/**
 * Database access layer.
 *
 * - Production: real PostgreSQL via `pg` (set DATABASE_URL).
 * - Local development: embedded PostgreSQL (PGlite, WebAssembly) persisted to
 *   ./data/pglite, so the project runs with zero database setup.
 *
 * Both drivers speak the same SQL dialect and use `$1, $2 ...` parameter
 * placeholders. All queries in this codebase are parameterised (no string
 * concatenation of user input) which protects against SQL injection.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let driver = null; // { query(text, params), transaction(fn), close(), kind }

const NUMERIC_OID = 1700;
const INT8_OID = 20;

async function createPg() {
  const pg = (await import('pg')).default;
  pg.types.setTypeParser(NUMERIC_OID, (v) => (v === null ? null : parseFloat(v)));
  pg.types.setTypeParser(INT8_OID, (v) => (v === null ? null : parseInt(v, 10)));
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
    max: 10,
  });
  return {
    kind: 'postgres',
    query: (text, params) => pool.query(text, params),
    exec: (sql) => pool.query(sql),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({ query: (t, p) => client.query(t, p) });
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

async function createPglite() {
  const { PGlite } = await import('@electric-sql/pglite');
  fs.mkdirSync(config.pgliteDir, { recursive: true });
  const db = new PGlite(config.pgliteDir, {
    parsers: {
      [NUMERIC_OID]: (v) => (v === null ? null : parseFloat(v)),
      [INT8_OID]: (v) => (v === null ? null : parseInt(v, 10)),
    },
  });
  await db.waitReady;
  // PGlite is single-connection: serialise access so transactions never interleave.
  let chain = Promise.resolve();
  const serial = (fn) => {
    const run = chain.then(fn, fn);
    chain = run.catch(() => {});
    return run;
  };
  return {
    kind: 'pglite',
    query: (text, params) => serial(() => db.query(text, params)),
    exec: (sql) => serial(() => db.exec(sql)),
    transaction: (fn) =>
      serial(() => db.transaction((tx) => fn({ query: (t, p) => tx.query(t, p) }))),
    close: () => db.close(),
  };
}

export async function initDb() {
  if (driver) return driver;
  driver = config.databaseUrl ? await createPg() : await createPglite();
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await driver.exec(schema);
  console.log(`[db] connected (${driver.kind === 'postgres' ? 'PostgreSQL' : `embedded PGlite at ${config.pgliteDir}`})`);
  return driver;
}

/** Run a parameterised query. Returns the array of rows. */
export async function query(text, params = []) {
  const res = await driver.query(text, params);
  return res.rows;
}

/** Return the first row or null. */
export async function one(text, params = []) {
  const rows = await query(text, params);
  return rows[0] || null;
}

/** Run `fn(tx)` inside a transaction; `tx.query` returns { rows }. */
export function transaction(fn) {
  return driver.transaction(fn);
}

export function closeDb() {
  return driver?.close();
}
