import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { deviceHolders, tenants } from './schema.js';

// Aparelhos gerenciados (Fase B). Todo dado sincronizado tem origem (`source`) e horário de observação:
// nada observado há tempo aparece como “ao vivo”, e “desconhecido” é diferente de “sem sinal”.

export const deviceManufacturer = pgEnum('device_manufacturer', ['samsung', 'motorola']);
export const managementMode = pgEnum('management_mode', ['fully_managed', 'dedicated']);
export const enrollmentState = pgEnum('enrollment_state', ['pending', 'enrolled', 'unenrolled']);
export const dataSource = pgEnum('data_source', ['simulator', 'android_management_api']);

/** Leitura de telemetria com o instante em que foi observada. */
export interface Observed<T> {
  value: T;
  observedAt: string;
}
export interface ObservedState {
  batteryPct?: Observed<number>;
  storageFreePct?: Observed<number>;
  network?: Observed<'wifi' | 'mobile' | 'none'>;
}

export const devices = pgTable(
  'devices',
  {
    id: uuid().primaryKey().defaultRandom(),
    tenantId: uuid()
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    displayName: text().notNull(),
    manufacturer: deviceManufacturer().notNull(),
    model: text().notNull(),
    androidVersion: smallint().notNull(),
    securityPatch: date({ mode: 'string' }),
    serialNumber: text(),
    managementMode: managementMode().notNull().default('fully_managed'),
    enrollmentState: enrollmentState().notNull().default('pending'),
    holderId: uuid(),
    source: dataSource().notNull().default('simulator'),
    /** Identificador externo no provedor (ex.: enterprises/…/devices/…). Nunca é o ID interno. */
    providerRef: text(),
    enrolledAt: timestamp({ withTimezone: true }),
    /** Última comunicação recebida do aparelho (null = nunca observado). */
    lastSeenAt: timestamp({ withTimezone: true }),
    observedState: jsonb().$type<ObservedState>().notNull().default({}),
    desiredState: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('devices_tenant_id_key').on(t.tenantId, t.id),
    uniqueIndex('devices_tenant_serial_key')
      .on(t.tenantId, t.serialNumber)
      .where(sql`${t.serialNumber} is not null`),
    index('devices_tenant_name_idx').on(t.tenantId, t.displayName),
    index('devices_tenant_seen_idx').on(t.tenantId, t.lastSeenAt),
    index('devices_tenant_holder_idx').on(t.tenantId, t.holderId),
    // Responsável precisa ser da MESMA empresa (FK composta: a checagem de FK ignora o RLS).
    foreignKey({
      name: 'devices_holder_same_tenant_fk',
      columns: [t.tenantId, t.holderId],
      foreignColumns: [deviceHolders.tenantId, deviceHolders.id],
    }).onDelete('restrict'),
    check('devices_name_len', sql`char_length(${t.displayName}) between 2 and 80`),
    check('devices_android_range', sql`${t.androidVersion} between 10 and 20`),
  ],
);

/** Metadados de tokens de cadastro. O valor do token nunca é guardado (só o hash). */
export const enrollmentTokens = pgTable(
  'enrollment_tokens',
  {
    id: uuid().primaryKey().defaultRandom(),
    tenantId: uuid()
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    tokenHash: text().notNull(),
    demo: boolean().notNull().default(true),
    managementMode: managementMode().notNull().default('fully_managed'),
    holderId: uuid(),
    displayNameHint: text(),
    providerRef: text(),
    createdBy: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedAt: timestamp({ withTimezone: true }),
    deviceId: uuid(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('enrollment_tokens_hash_key').on(t.tokenHash),
    index('enrollment_tokens_tenant_idx').on(t.tenantId, t.createdAt),
    foreignKey({
      name: 'enrollment_tokens_holder_same_tenant_fk',
      columns: [t.tenantId, t.holderId],
      foreignColumns: [deviceHolders.tenantId, deviceHolders.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'enrollment_tokens_device_same_tenant_fk',
      columns: [t.tenantId, t.deviceId],
      foreignColumns: [devices.tenantId, devices.id],
    }).onDelete('restrict'),
  ],
);

/** Linha do tempo do aparelho (somente inserção). */
export const deviceEvents = pgTable(
  'device_events',
  {
    id: uuid().primaryKey().defaultRandom(),
    tenantId: uuid()
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    deviceId: uuid().notNull(),
    occurredAt: timestamp({ withTimezone: true }).notNull(),
    type: text().notNull(),
    source: dataSource().notNull().default('simulator'),
    details: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('device_events_device_time_idx').on(t.tenantId, t.deviceId, t.occurredAt),
    foreignKey({
      name: 'device_events_device_same_tenant_fk',
      columns: [t.tenantId, t.deviceId],
      foreignColumns: [devices.tenantId, devices.id],
    }).onDelete('restrict'),
  ],
);

/**
 * Estado interno do SIMULADOR (perfil de comportamento de cada aparelho sintético). Fica separado dos
 * dados do produto: nada aqui é exibido como informação real.
 */
export const simDeviceProfile = pgEnum('sim_device_profile', ['reliable', 'flaky', 'silent', 'never_seen']);

export const simDevices = pgTable(
  'sim_devices',
  {
    deviceId: uuid().primaryKey(),
    tenantId: uuid()
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    profile: simDeviceProfile().notNull(),
    batteryDrainPerHour: smallint().notNull().default(4),
    nextCheckInAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index('sim_devices_due_idx').on(t.nextCheckInAt),
    foreignKey({
      name: 'sim_devices_device_same_tenant_fk',
      columns: [t.tenantId, t.deviceId],
      foreignColumns: [devices.tenantId, devices.id],
    }).onDelete('cascade'),
  ],
);

export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
export type DeviceEvent = typeof deviceEvents.$inferSelect;
