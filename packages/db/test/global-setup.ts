import { resetDatabase, runMigrations } from '../src/migrate.js';

/** Recria o banco de testes do zero e aplica todas as migrações, como numa instalação nova. */
export default async function setup() {
  const url = process.env.TEST_MIGRATOR_DATABASE_URL;
  if (!url) throw new Error('TEST_MIGRATOR_DATABASE_URL ausente — rode `pnpm setup`');
  await resetDatabase(url);
  await runMigrations(url);
}
