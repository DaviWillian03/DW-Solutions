import { resetDatabase, runMigrations } from '@dw/db';

export default async function setup() {
  await resetDatabase(process.env.TEST_MIGRATOR_DATABASE_URL!);
  await runMigrations(process.env.TEST_MIGRATOR_DATABASE_URL!);
}
