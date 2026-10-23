import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  inet,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
};

// ---------------------------------------------------------------------------
// Empresas (tabela de plataforma). A aplicação só enxerga a própria empresa (RLS).
// ---------------------------------------------------------------------------
export const tenantStatus = pgEnum('tenant_status', ['active', 'suspended']);

export const tenants = pgTable(
  'tenants',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    slug: text().notNull(),
    status: tenantStatus().notNull().default('active'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('tenants_slug_key').on(t.slug),
    check('tenants_name_len', sql`char_length(${t.name}) between 2 and 120`),
    check('tenants_slug_format', sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
  ],
);

// ---------------------------------------------------------------------------
// Responsáveis pelos aparelhos (vendedores, promotores). Não são usuários do sistema.
// Exclusão segura: desativar (status), nunca apagar.
// ---------------------------------------------------------------------------
export const holderRole = pgEnum('holder_role', ['sales', 'merchandising', 'other']);
export const holderStatus = pgEnum('holder_status', ['active', 'inactive']);

export const deviceHolders = pgTable(
  'device_holders',
  {
    id: uuid().primaryKey().defaultRandom(),
    tenantId: uuid()
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    fullName: text().notNull(),
    employeeCode: text(),
    email: text(),
    phone: text(),
    role: holderRole().notNull().default('sales'),
    status: holderStatus().notNull().default('active'),
    ...timestamps,
  },
  (t) => [
    index('device_holders_tenant_name_idx').on(t.tenantId, t.fullName),
    uniqueIndex('device_holders_tenant_code_key')
      .on(t.tenantId, t.employeeCode)
      .where(sql`${t.employeeCode} is not null`),
    check('device_holders_name_len', sql`char_length(${t.fullName}) between 2 and 120`),
  ],
);

// ---------------------------------------------------------------------------
// Auditoria append-only com cadeia de hash por empresa (preenchida por gatilho no banco).
// ---------------------------------------------------------------------------
export const auditActorType = pgEnum('audit_actor_type', ['user', 'platform', 'system']);
export const auditOutcome = pgEnum('audit_outcome', ['success', 'denied', 'failure']);

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid().primaryKey().defaultRandom(),
    tenantId: uuid()
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    seq: bigint({ mode: 'number' }).notNull(),
    occurredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    actorType: auditActorType().notNull(),
    actorId: text(),
    action: text().notNull(),
    targetType: text(),
    targetId: text(),
    outcome: auditOutcome().notNull().default('success'),
    reason: text(),
    metadata: jsonb().notNull().default({}),
    requestId: text(),
    sourceIp: inet(),
    prevHash: text().notNull(),
    hash: text().notNull(),
  },
  (t) => [
    uniqueIndex('audit_events_tenant_seq_key').on(t.tenantId, t.seq),
    index('audit_events_tenant_time_idx').on(t.tenantId, t.occurredAt),
  ],
);

export type Tenant = typeof tenants.$inferSelect;
export type DeviceHolder = typeof deviceHolders.$inferSelect;
export type NewDeviceHolder = typeof deviceHolders.$inferInsert;
export type AuditEvent = typeof auditEvents.$inferSelect;
