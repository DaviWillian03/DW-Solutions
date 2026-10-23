import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as authSchema from './auth-schema.js';
import * as deviceSchema from './device-schema.js';
import * as baseSchema from './schema.js';

const schema = { ...baseSchema, ...authSchema, ...deviceSchema };

export type Database = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface DbHandle {
  db: Database;
  pool: pg.Pool;
  close: () => Promise<void>;
}

export function createDb(connectionString: string, max = 10): DbHandle {
  const pool = new pg.Pool({ connectionString, max, connectionTimeoutMillis: 2_000 });
  const db = drizzle({ client: pool, schema, casing: 'snake_case' });
  return { db, pool, close: () => pool.end() };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Única forma de acessar dados de empresa (ADR-0004): abre uma transação e define a empresa só para
 * ela (`SET LOCAL` via set_config). O RLS do PostgreSQL bloqueia qualquer linha de outra empresa.
 */
export async function withTenant<T>(
  db: Database,
  tenantId: string,
  fn: (tx: Tx) => Promise<T>,
  opts: { userId?: string } = {},
): Promise<T> {
  if (!UUID.test(tenantId)) throw new Error('tenantId inválido');
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    if (opts.userId) await tx.execute(sql`select set_config('app.user_id', ${opts.userId}, true)`);
    return fn(tx);
  });
}
