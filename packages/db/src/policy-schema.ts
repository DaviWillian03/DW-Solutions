import type { PolicySettings } from '@dw/contracts';
import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenants } from './schema.js';

// Políticas (Fase C). Cada alteração vira uma NOVA versão imutável; `current_version` só avança com
// controle de concorrência (quem editou a partir de uma versão antiga recebe conflito, não sobrescreve).

export const policyTemplate = pgEnum('policy_template', ['sales', 'merchandising']);
export const complianceState = pgEnum('compliance_state', [
  'compliant',
  'noncompliant',
  'unknown',
  'not_applicable',
]);

export const policies = pgTable(
  'policies',
  {
    id: uuid().primaryKey().defaultRandom(),
    tenantId: uuid()
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    template: policyTemplate().notNull(),
    name: text().notNull(),
    description: text().notNull().default(''),
    currentVersion: integer().notNull().default(1),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('policies_tenant_id_key').on(t.tenantId, t.id),
    uniqueIndex('policies_tenant_template_key').on(t.tenantId, t.template),
    check('policies_version_positive', sql`${t.currentVersion} >= 1`),
  ],
);

export const policyVersions = pgTable(
  'policy_versions',
  {
    id: uuid().primaryKey().defaultRandom(),
    tenantId: uuid()
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    policyId: uuid().notNull(),
    version: integer().notNull(),
    settings: jsonb().$type<PolicySettings>().notNull(),
    /** Por que a versão foi criada (obrigatório; aparece no histórico). */
    note: text().notNull(),
    createdBy: text().notNull(),
    createdByName: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('policy_versions_policy_version_key').on(t.tenantId, t.policyId, t.version),
    foreignKey({
      name: 'policy_versions_policy_same_tenant_fk',
      columns: [t.tenantId, t.policyId],
      foreignColumns: [policies.tenantId, policies.id],
    }).onDelete('restrict'),
    check('policy_versions_note_len', sql`char_length(${t.note}) between 3 and 300`),
  ],
);

export type Policy = typeof policies.$inferSelect;
export type PolicyVersion = typeof policyVersions.$inferSelect;
