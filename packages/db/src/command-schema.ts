import { COMMAND_STATES, COMMAND_TYPES } from '@dw/contracts';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { devices } from './device-schema.js';
import { tenants } from './schema.js';

// Comandos remotos (Fase D). Cada transição de estado fica em command_events (somente inserção), com
// quem/o que a causou: usuário, sistema, provedor ou o próprio aparelho.

export const commandType = pgEnum('command_type', COMMAND_TYPES);
export const commandState = pgEnum('command_state', COMMAND_STATES);
export const batchStatus = pgEnum('command_batch_status', [
  'not_required',
  'waiting_approval',
  'approved',
  'rejected',
  'expired',
]);

/** Pedido feito para vários aparelhos de uma vez (com aprovação de um 2º admin quando exigido). */
export const commandBatches = pgTable(
  'command_batches',
  {
    id: uuid().primaryKey().defaultRandom(),
    tenantId: uuid()
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    type: commandType().notNull(),
    reason: text(),
    deviceCount: integer().notNull(),
    status: batchStatus().notNull(),
    requestedBy: text().notNull(),
    requestedByName: text().notNull(),
    decidedBy: text(),
    decidedByName: text(),
    decidedAt: timestamp({ withTimezone: true }),
    decisionNote: text(),
    expiresAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('command_batches_tenant_id_key').on(t.tenantId, t.id),
    index('command_batches_status_idx').on(t.tenantId, t.status),
    // Quem pede não aprova (segregação de funções, prompt-mestre §8).
    check(
      'command_batches_not_self_approved',
      sql`${t.decidedBy} is null or ${t.status} <> 'approved' or ${t.decidedBy} <> ${t.requestedBy}`,
    ),
  ],
);

export const deviceCommands = pgTable(
  'device_commands',
  {
    id: uuid().primaryKey().defaultRandom(),
    tenantId: uuid()
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    deviceId: uuid().notNull(),
    batchId: uuid(),
    type: commandType().notNull(),
    params: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    reason: text(),
    state: commandState().notNull(),
    /** Detalhe do estado atual (ex.: motivo da falha), em português. */
    stateDetail: text(),
    requestedBy: text().notNull(),
    requestedByName: text().notNull(),
    /** Repetir o mesmo pedido com a mesma chave devolve o comando já criado. */
    idempotencyKey: text(),
    /** Liga o comando à requisição HTTP e aos logs. */
    correlationId: text(),
    providerRef: text(),
    sendAttempts: integer().notNull().default(0),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    finishedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('device_commands_tenant_id_key').on(t.tenantId, t.id),
    uniqueIndex('device_commands_idempotency_key')
      .on(t.tenantId, t.idempotencyKey)
      .where(sql`${t.idempotencyKey} is not null`),
    index('device_commands_device_idx').on(t.tenantId, t.deviceId, t.createdAt),
    index('device_commands_state_idx').on(t.tenantId, t.state),
    index('device_commands_batch_idx').on(t.tenantId, t.batchId),
    foreignKey({
      name: 'device_commands_device_same_tenant_fk',
      columns: [t.tenantId, t.deviceId],
      foreignColumns: [devices.tenantId, devices.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'device_commands_batch_same_tenant_fk',
      columns: [t.tenantId, t.batchId],
      foreignColumns: [commandBatches.tenantId, commandBatches.id],
    }).onDelete('restrict'),
  ],
);

export const commandEvents = pgTable(
  'command_events',
  {
    id: uuid().primaryKey().defaultRandom(),
    tenantId: uuid()
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    commandId: uuid().notNull(),
    state: commandState().notNull(),
    /** user:<id> · system · provider · device */
    actor: text().notNull(),
    detail: text(),
    occurredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('command_events_command_idx').on(t.tenantId, t.commandId, t.occurredAt),
    foreignKey({
      name: 'command_events_command_same_tenant_fk',
      columns: [t.tenantId, t.commandId],
      foreignColumns: [deviceCommands.tenantId, deviceCommands.id],
    }).onDelete('restrict'),
  ],
);

/** Configurações da empresa. Apagar aparelhos (wipe) começa DESLIGADO (prompt-mestre §5.7). */
export const tenantSettings = pgTable('tenant_settings', {
  tenantId: uuid()
    .primaryKey()
    .references(() => tenants.id, { onDelete: 'restrict' }),
  wipeEnabled: boolean().notNull().default(false),
  updatedBy: text(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type DeviceCommand = typeof deviceCommands.$inferSelect;
export type CommandBatch = typeof commandBatches.$inferSelect;
