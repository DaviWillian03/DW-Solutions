import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenants } from './schema.js';

// Tabelas de identidade usadas pelo Better Auth (ADR-0003). Os nomes das propriedades seguem os campos
// exigidos pela biblioteca (conferidos com getAuthTables na versão 1.7.10).
// Acesso: papel dw_auth (login); dw_app só lê/gerencia usuários da própria empresa (RLS).

const ts = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
};

export const USER_ROLES = ['admin', 'viewer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const authUsers = pgTable(
  'auth_users',
  {
    id: text().primaryKey(),
    tenantId: uuid()
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    name: text().notNull(),
    email: text().notNull(),
    emailVerified: boolean().notNull().default(false),
    image: text(),
    role: text().notNull().$type<UserRole>(),
    status: text().notNull().default('active').$type<'active' | 'disabled'>(),
    twoFactorEnabled: boolean().notNull().default(false),
    ...ts,
  },
  (t) => [
    uniqueIndex('auth_users_email_key').on(sql`lower(${t.email})`),
    index('auth_users_tenant_idx').on(t.tenantId),
    check('auth_users_role_check', sql`${t.role} in ('admin', 'viewer')`),
    check('auth_users_status_check', sql`${t.status} in ('active', 'disabled')`),
    check('auth_users_email_format', sql`${t.email} = lower(${t.email}) and ${t.email} like '%_@_%'`),
  ],
);

export const authSessions = pgTable(
  'auth_sessions',
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    token: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ipAddress: text(),
    userAgent: text(),
    ...ts,
  },
  (t) => [uniqueIndex('auth_sessions_token_key').on(t.token), index('auth_sessions_user_idx').on(t.userId)],
);

export const authAccounts = pgTable(
  'auth_accounts',
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    accountId: text().notNull(),
    providerId: text().notNull(),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    ...ts,
  },
  (t) => [index('auth_accounts_user_idx').on(t.userId)],
);

export const authVerifications = pgTable(
  'auth_verifications',
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ...ts,
  },
  (t) => [index('auth_verifications_identifier_idx').on(t.identifier)],
);

export const authTwoFactors = pgTable(
  'auth_two_factors',
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    secret: text().notNull(),
    backupCodes: text().notNull(),
    verified: boolean().default(false),
    failedVerificationCount: integer().default(0),
    lockedUntil: timestamp({ withTimezone: true }),
  },
  (t) => [uniqueIndex('auth_two_factors_user_key').on(t.userId)],
);

export const authPasskeys = pgTable(
  'auth_passkeys',
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    name: text(),
    publicKey: text().notNull(),
    credentialID: text('credential_id').notNull(),
    counter: integer().notNull(),
    deviceType: text().notNull(),
    backedUp: boolean().notNull(),
    transports: text(),
    aaguid: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex('auth_passkeys_credential_key').on(t.credentialID),
    index('auth_passkeys_user_idx').on(t.userId),
  ],
);

// Convites: guardamos só o hash do token (o token em si aparece uma única vez).
export const userInvitations = pgTable(
  'user_invitations',
  {
    id: uuid().primaryKey().defaultRandom(),
    tenantId: uuid()
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    userId: text()
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    tokenHash: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedAt: timestamp({ withTimezone: true }),
    createdBy: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('user_invitations_token_key').on(t.tokenHash),
    index('user_invitations_tenant_idx').on(t.tenantId),
  ],
);

export type AuthUser = typeof authUsers.$inferSelect;
