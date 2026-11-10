/**
 * Database backup.
 *   PostgreSQL (DATABASE_URL set): runs `pg_dump` -> backups/bapin-YYYY-MM-DD-HHmm.sql
 *   Embedded PGlite (dev):          dumps the data directory -> backups/bapin-pglite-....tar.gz
 *
 * Keeps the newest 30 backups. Schedule it daily (cron / Task Scheduler) — see docs/DEPLOYMENT.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawn } from 'node:child_process';
import { config, SERVER_ROOT } from '../src/config.js';

const dir = path.join(SERVER_ROOT, 'backups');
fs.mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

async function main() {
  let file;
  if (config.databaseUrl) {
    file = path.join(dir, `bapin-${stamp}.sql`);
    await new Promise((resolve, reject) => {
      const p = spawn('pg_dump', ['--no-owner', '--no-privileges', '-f', file, config.databaseUrl], { stdio: 'inherit' });
      p.on('error', (e) => reject(new Error(`pg_dump not found or failed: ${e.message}`)));
      p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`pg_dump exited with code ${code}`))));
    });
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const db = new PGlite(config.pgliteDir);
    // PGlite's WASM promises don't hold the Node event loop open on their own.
    const keepAlive = setInterval(() => {}, 1000);
    await db.waitReady;
    // PGlite's built-in 'gzip' option stalls under Node, so dump raw and compress with zlib.
    const blob = await db.dumpDataDir('none');
    file = path.join(dir, `bapin-pglite-${stamp}.tar.gz`);
    fs.writeFileSync(file, zlib.gzipSync(Buffer.from(await blob.arrayBuffer())));
    await db.close();
    clearInterval(keepAlive);
  }
  console.log(`[backup] saved ${file}`);

  const files = fs.readdirSync(dir).filter((f) => f.startsWith('bapin-')).sort();
  for (const old of files.slice(0, Math.max(0, files.length - 30))) fs.unlinkSync(path.join(dir, old));
}

main().catch((err) => {
  console.error('[backup] failed:', err.message);
  process.exit(1);
});
