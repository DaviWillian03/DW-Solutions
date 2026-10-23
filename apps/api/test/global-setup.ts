import { resetDatabase, runMigrations } from '@dw/db';

export default async function setup() {
  const url = process.env.TEST_MIGRATOR_DATABASE_URL;
  if (!url) throw new Error('TEST_MIGRATOR_DATABASE_URL ausente — rode `pnpm setup`');
  await resetDatabase(url);
  await runMigrations(url);
}
