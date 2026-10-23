export * from './schema.js';
export * from './auth-schema.js';
export * from './device-schema.js';
export * from './policy-schema.js';
export { ensureDefaultPolicies } from './policies.js';
export { createDb, withTenant, type Database, type DbHandle, type Tx } from './client.js';
export { recordAudit, verifyAuditChain, redact, type AuditInput, type ChainProblem } from './audit.js';
export { runMigrations, resetDatabase, MIGRATIONS_DIR } from './migrate.js';
// Operadores do Drizzle reexportados: os apps usam a mesma instância de tipos deste pacote.
export {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from 'drizzle-orm';
