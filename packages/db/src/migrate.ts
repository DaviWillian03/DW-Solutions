import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

export const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations', import.meta.url));

/** Aplica as migrações com o papel dw_migrator (dono das tabelas). */
export async function runMigrations(migratorUrl: string): Promise<void> {
  const pool = new pg.Pool({ connectionString: migratorUrl, max: 1 });
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: MIGRATIONS_DIR });
  } finally {
    await pool.end();
  }
}

/** Apaga e recria o esquema (só para bancos de teste). */
export async function resetDatabase(migratorUrl: string): Promise<void> {
  const url = new URL(migratorUrl);
  if (!url.pathname.endsWith('_test')) throw new Error('resetDatabase só pode ser usado em bancos *_test');
  const client = new pg.Client({ connectionString: migratorUrl });
  await client.connect();
  try {
    await client.query(
      'DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;',
    );
  } finally {
    await client.end();
  }
}
