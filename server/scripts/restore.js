/**
 * Restore a backup made by `npm run backup`.
 *   npm run restore -- backups/bapin-2026-01-01-10-00.json.gz --yes
 * This REPLACES all current data in the database. Without --yes it only
 * prints what the file contains.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { BSON } from 'mongodb';

const { EJSON } = BSON;
import { initDb, col, closeDb } from '../src/db/index.js';

async function main() {
  const file = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!file) throw new Error('Usage: npm run restore -- <backup-file.json.gz> --yes');
  const data = EJSON.parse(zlib.gunzipSync(fs.readFileSync(path.resolve(file))).toString('utf8'), { relaxed: false });
  const entries = Object.entries(data.collections || {});
  console.log(`[restore] ${file} (created ${data.created_at?.toISOString?.() || '?'})`);
  for (const [name, docs] of entries) console.log(`  ${name}: ${docs.length}`);
  if (!process.argv.includes('--yes')) {
    console.log('[restore] dry run. Add --yes to replace the current database with this backup.');
    return;
  }
  await initDb();
  for (const [name, docs] of entries) {
    await col(name).deleteMany({});
    if (docs.length) await col(name).insertMany(docs);
  }
  await closeDb();
  console.log('[restore] done.');
}

main().catch((err) => {
  console.error('[restore] failed:', err.message);
  process.exit(1);
});
