/**
 * Builds the React website (client/dist) after `npm install` in /server on a
 * hosting platform (Render sets RENDER=true; set BUILD_CLIENT=true elsewhere).
 * This lets a service whose Root Directory is `server` with build command
 * `npm install` still serve the website. Skipped on developer machines.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const client = path.join(root, 'client');
const onHost = process.env.RENDER === 'true' || process.env.BUILD_CLIENT === 'true';

if (!onHost) process.exit(0);
if (fs.existsSync(path.join(client, 'dist', 'index.html'))) {
  console.log('[build-client] client/dist already built - skipping');
  process.exit(0);
}
if (!fs.existsSync(path.join(client, 'package.json'))) {
  console.log('[build-client] client/ folder not found - skipping website build');
  process.exit(0);
}

const run = (cmd) => {
  console.log(`[build-client] ${cmd}`);
  execSync(cmd, { cwd: client, stdio: 'inherit' });
};
run('npm ci --include=dev --no-audit --no-fund');
run('npm run build');
console.log('[build-client] website built to client/dist');
