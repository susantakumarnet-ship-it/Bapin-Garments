/**
 * Database backup: exports every collection to
 *   backups/bapin-YYYY-MM-DD-HH-mm.json.gz
 * using MongoDB Extended JSON (dates and numbers round-trip exactly).
 * Restore with `npm run restore -- backups/<file>.json.gz`.
 *
 * Keeps the newest 30 backups. Schedule it daily (cron / Task Scheduler) — see docs/DEPLOYMENT.md.
 * On MongoDB Atlas, also turn on Atlas's own backups for paid clusters.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { BSON } from 'mongodb';

const { EJSON } = BSON;
import { SERVER_ROOT } from '../src/config.js';
import { initDb, col, closeDb, COLLECTIONS } from '../src/db/index.js';

const dir = path.join(SERVER_ROOT, 'backups');
fs.mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

async function main() {
  await initDb();
  const data = { created_at: new Date(), collections: {} };
  for (const name of [...COLLECTIONS, 'counters', 'app_secrets']) {
    data.collections[name] = await col(name).find({}).toArray();
  }
  const file = path.join(dir, `bapin-${stamp}.json.gz`);
  fs.writeFileSync(file, zlib.gzipSync(EJSON.stringify(data, { relaxed: false })));
  await closeDb();
  const counts = Object.entries(data.collections).map(([k, v]) => `${k}=${v.length}`).join(' ');
  console.log(`[backup] saved ${file}\n[backup] ${counts}`);

  const files = fs.readdirSync(dir).filter((f) => f.startsWith('bapin-')).sort();
  for (const old of files.slice(0, Math.max(0, files.length - 30))) fs.unlinkSync(path.join(dir, old));
}

main().catch((err) => {
  console.error('[backup] failed:', err.message);
  process.exit(1);
});
