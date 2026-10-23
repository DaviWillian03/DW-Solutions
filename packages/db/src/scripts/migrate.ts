import { runMigrations } from '../migrate.js';

const url = process.env.MIGRATOR_DATABASE_URL;
if (!url) {
  console.error('MIGRATOR_DATABASE_URL ausente — rode `pnpm setup`.');
  process.exit(1);
}
await runMigrations(url);
console.log('Migrações aplicadas.');
