import { randomUUID } from 'node:crypto';
import { passkey } from '@better-auth/passkey';
import {
  authAccounts,
  authPasskeys,
  authSessions,
  authTwoFactors,
  authUsers,
  authVerifications,
  eq,
  recordAudit,
  withTenant,
  type DbHandle,
} from '@dw/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware, isAPIError } from 'better-auth/api';
import { twoFactor } from 'better-auth/plugins/two-factor';
import type { Logger } from 'pino';
import type { Env } from '../config/env.js';
import { LoginThrottle } from './login-throttle.js';

export interface AuthDeps {
  env: Env;
  appDb: DbHandle;
  authDb: DbHandle;
  throttle: LoginThrottle;
  logger: Logger;
}

function clientIp(headers: Headers | undefined): string | null {
  const xff = headers?.get('x-forwarded-for');
  const ip = xff?.split(',')[0]?.trim();
  return ip && /^[0-9a-fA-F.:]{3,45}$/.test(ip) ? ip : null;
}

/** Configuração do Better Auth conforme ADR-0003. */
export function createAuth({ env, appDb, authDb, throttle, logger }: AuthDeps) {
  const findUser = async (by: { id?: string; email?: string }) => {
    const where = by.id
      ? eq(authUsers.id, by.id)
      : eq(authUsers.email, (by.email ?? '').trim().toLowerCase());
    const [u] = await authDb.db.select().from(authUsers).where(where).limit(1);
    return u;
  };

  const audit = async (
    tenantId: string,
    input: Omit<Parameters<typeof recordAudit>[1], 'tenantId' | 'actorType'>,
  ) => {
    try {
      await withTenant(appDb.db, tenantId, (tx) =>
        recordAudit(tx, { tenantId, actorType: 'user', ...input }),
      );
    } catch (err) {
      // Falha de auditoria não pode passar despercebida.
      logger.error({ err: (err as Error).message, action: input.action }, 'falha ao registrar auditoria');
    }
  };

  return betterAuth({
    appName: 'DW Solutions',
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.WEB_ORIGIN],
    database: drizzleAdapter(authDb.db, {
      provider: 'pg',
      schema: {
        user: authUsers,
        session: authSessions,
        account: authAccounts,
        verification: authVerifications,
        twoFactor: authTwoFactors,
        passkey: authPasskeys,
      },
    }),
    emailAndPassword: {
      enabled: true,
      // Empresas e usuários só entram por convite (ADR-0005, CP3-7).
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
    },
    user: {
      additionalFields: {
        tenantId: { type: 'string', required: true, input: false },
        role: { type: 'string', required: true, input: false },
        status: { type: 'string', required: true, defaultValue: 'active', input: false },
      },
      changeEmail: { enabled: false },
      deleteUser: { enabled: false },
    },
    session: {
      expiresIn: 60 * 60 * 12,
      updateAge: 60 * 60,
      // ADR-0003: cookieCache desligado (bypass de 2FA em versões antigas).
      cookieCache: { enabled: false },
    },
    advanced: {
      cookiePrefix: 'dw',
      useSecureCookies: true,
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
      ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
      database: { generateId: () => randomUUID() },
      // A biblioteca desliga a checagem de origem quando detecta ambiente de teste; forçamos o
      // comportamento de produção para que os testes provem a proteção real.
      disableOriginCheck: false,
      disableCSRFCheck: false,
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      storage: 'memory',
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/two-factor/verify-totp': { window: 60, max: 5 },
        '/two-factor/verify-backup-code': { window: 60, max: 5 },
        '/two-factor/enable': { window: 60, max: 5 },
      },
    },
    plugins: [
      twoFactor({ issuer: 'DW Solutions', backupCodeOptions: { amount: 10, length: 10 } }),
      passkey({ rpID: new URL(env.WEB_ORIGIN).hostname, rpName: 'DW Solutions', origin: env.WEB_ORIGIN }),
    ],
    databaseHooks: {
      session: {
        create: {
          // Usuário desativado não abre sessão.
          before: async (session) => {
            const u = await findUser({ id: session.userId });
            if (!u || u.status !== 'active') {
              throw new APIError('FORBIDDEN', { message: 'Usuário desativado.' });
            }
          },
          after: async (session) => {
            const u = await findUser({ id: session.userId });
            if (!u) return;
            await throttle.reset(u.email);
            await audit(u.tenantId, {
              actorId: u.id,
              action: 'auth.login',
              targetType: 'session',
              targetId: session.id,
              sourceIp:
                session.ipAddress && /^[0-9a-fA-F.:]+$/.test(session.ipAddress) ? session.ipAddress : null,
              metadata: { userAgent: session.userAgent?.slice(0, 200) ?? null },
            });
          },
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/sign-in/email') {
          const email = String((ctx.body as { email?: unknown } | undefined)?.email ?? '');
          if (email && (await throttle.isBlocked(email))) {
            throw new APIError('TOO_MANY_REQUESTS', {
              message: 'Muitas tentativas para esta conta. Tente novamente em alguns minutos.',
            });
          }
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/sign-in/email') return;
        const returned = ctx.context.returned;
        if (!isAPIError(returned) || returned.status === 'TOO_MANY_REQUESTS') return;
        const email = String((ctx.body as { email?: unknown } | undefined)?.email ?? '');
        if (!email) return;
        await throttle.fail(email);
        const u = await findUser({ email });
        if (u) {
          await audit(u.tenantId, {
            actorId: u.id,
            action: 'auth.login',
            outcome: 'denied',
            reason: 'senha inválida ou usuário desativado',
            sourceIp: clientIp(ctx.headers),
          });
        }
      }),
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
export const AUTH = Symbol('AUTH');
