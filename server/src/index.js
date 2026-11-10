import { config } from './config.js';
import { initDb, one } from './db/index.js';
import { createApp } from './app.js';
import { seedDatabase } from './db/seed.js';

async function main() {
  await initDb();

  // First run: create the default admin and sample catalogue automatically.
  const admins = await one('SELECT COUNT(*)::int AS n FROM admin_users');
  if (admins.n === 0) {
    console.log('[seed] empty database detected — loading sample data...');
    await seedDatabase();
  }

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`\n  Bapin Garments API running on http://localhost:${config.port}`);
    console.log(`  Environment: ${config.isProd ? 'production' : 'development'}\n`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
