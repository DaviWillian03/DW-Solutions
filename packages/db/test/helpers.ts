import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { createDb, type DbHandle } from '../src/client.js';
import { tenants } from '../src/schema.js';

export const app = () => createDb(process.env.TEST_DATABASE_URL!, 4);
export const platform = () => createDb(process.env.TEST_PLATFORM_DATABASE_URL!, 2);
export const migrator = () => createDb(process.env.TEST_MIGRATOR_DATABASE_URL!, 2);
export const auth = () => createDb(process.env.TEST_AUTH_DATABASE_URL!, 2);

/** Cria uma empresa como a plataforma faria (papel dw_platform). */
export async function createTenant(plat: DbHandle, name = 'Empresa Teste'): Promise<string> {
  const slug = `t-${randomUUID().slice(0, 8)}`;
  const [row] = await plat.db.insert(tenants).values({ name, slug }).returning({ id: tenants.id });
  return row!.id;
}

/** Código de erro do PostgreSQL de uma exceção do driver (o Drizzle embrulha o erro original). */
export function pgCode(err: unknown): string | undefined {
  let e = err as { code?: string; cause?: unknown } | undefined;
  while (e) {
    if (e.code) return e.code;
    e = e.cause as typeof e;
  }
  return undefined;
}

export async function expectPgError(p: Promise<unknown>, code: string) {
  try {
    await p;
  } catch (err) {
    if (pgCode(err) === code) return;
    throw err;
  }
  throw new Error(`esperava erro PostgreSQL ${code}, mas a operação funcionou`);
}

export { sql };
