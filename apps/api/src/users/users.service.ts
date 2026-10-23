import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  authAccounts,
  authSessions,
  authUsers,
  eq,
  gt,
  isNull,
  ne,
  recordAudit,
  sql,
  tenants,
  userInvitations,
  withTenant,
  type DbHandle,
  type UserRole,
} from '@dw/db';
import { AUTH, type Auth } from '../auth/auth.js';
import type { AuthContext } from '../auth/decorators.js';
import { ENV, type Env } from '../config/env.js';
import { APP_DB, AUTH_DB } from '../infra/infra.module.js';
import {
  INVITATION_TTL_MS,
  hashInvitationToken,
  invitationUrl,
  newInvitationToken,
} from './invitation-token.js';

const publicUser = {
  id: authUsers.id,
  name: authUsers.name,
  email: authUsers.email,
  role: authUsers.role,
  status: authUsers.status,
  twoFactorEnabled: authUsers.twoFactorEnabled,
  createdAt: authUsers.createdAt,
};

function isUniqueViolation(err: unknown): boolean {
  let e = err as { code?: string; cause?: unknown } | undefined;
  while (e) {
    if (e.code === '23505') return true;
    e = e.cause as typeof e;
  }
  return false;
}

@Injectable()
export class UsersService {
  constructor(
    @Inject(APP_DB) private readonly appDb: DbHandle,
    @Inject(AUTH_DB) private readonly authDb: DbHandle,
    @Inject(AUTH) private readonly auth: Auth,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async me(a: AuthContext) {
    return withTenant(this.appDb.db, a.tenantId, async (tx) => {
      const [user] = await tx.select(publicUser).from(authUsers).where(eq(authUsers.id, a.userId));
      const [tenant] = await tx.select({ id: tenants.id, name: tenants.name }).from(tenants);
      return { user, tenant, mfaRequired: a.role === 'admin' && !a.twoFactorEnabled };
    });
  }

  list(a: AuthContext) {
    return withTenant(this.appDb.db, a.tenantId, (tx) =>
      tx.select(publicUser).from(authUsers).orderBy(asc(authUsers.name)),
    );
  }

  async invite(a: AuthContext, input: { name: string; email: string; role: UserRole }) {
    const { token, tokenHash } = newInvitationToken();
    const userId = randomUUID();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    try {
      await withTenant(this.appDb.db, a.tenantId, async (tx) => {
        await tx.insert(authUsers).values({
          id: userId,
          tenantId: a.tenantId,
          name: input.name,
          email: input.email,
          role: input.role,
        });
        await tx.insert(userInvitations).values({
          tenantId: a.tenantId,
          userId,
          tokenHash,
          expiresAt,
          createdBy: a.userId,
        });
        await recordAudit(tx, {
          tenantId: a.tenantId,
          actorType: 'user',
          actorId: a.userId,
          action: 'user.invite',
          targetType: 'user',
          targetId: userId,
          metadata: { role: input.role },
          requestId: a.requestId,
        });
      });
    } catch (err) {
      // Mensagem genérica: não revela se o e-mail existe em outra empresa.
      if (isUniqueViolation(err))
        throw new ConflictException({ code: 'EMAIL_UNAVAILABLE', message: 'E-mail indisponível.' });
      throw err;
    }
    return { userId, inviteUrl: invitationUrl(this.env.WEB_ORIGIN, token), expiresAt };
  }

  async disable(a: AuthContext, userId: string, reason: string) {
    if (userId === a.userId) {
      throw new BadRequestException({
        code: 'CANNOT_DISABLE_SELF',
        message: 'Você não pode desativar a si mesmo.',
      });
    }
    await withTenant(this.appDb.db, a.tenantId, async (tx) => {
      const [target] = await tx
        .select({ id: authUsers.id, role: authUsers.role, status: authUsers.status })
        .from(authUsers)
        .where(eq(authUsers.id, userId))
        .for('update');
      // RLS: usuário de outra empresa simplesmente não existe aqui.
      if (!target) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Usuário não encontrado.' });
      if (target.status === 'disabled') return;
      if (target.role === 'admin') {
        const [{ n }] = (await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(authUsers)
          .where(
            and(eq(authUsers.role, 'admin'), eq(authUsers.status, 'active'), ne(authUsers.id, userId)),
          )) as [{ n: number }];
        if (n === 0) {
          throw new BadRequestException({
            code: 'LAST_ADMIN',
            message: 'A empresa precisa de ao menos um administrador ativo.',
          });
        }
      }
      await tx.update(authUsers).set({ status: 'disabled' }).where(eq(authUsers.id, userId));
      await recordAudit(tx, {
        tenantId: a.tenantId,
        actorType: 'user',
        actorId: a.userId,
        action: 'user.disable',
        targetType: 'user',
        targetId: userId,
        reason,
        requestId: a.requestId,
      });
    });
    // Revogação imediata: todas as sessões do usuário desativado deixam de valer.
    await this.authDb.db.delete(authSessions).where(eq(authSessions.userId, userId));
  }

  /** Aceite de convite (rota pública): define a senha do convidado. */
  async acceptInvitation(token: string, password: string) {
    const ctx = await this.auth.$context;
    const tokenHash = hashInvitationToken(token);
    const accepted = await this.authDb.db.transaction(async (tx) => {
      const [inv] = await tx
        .update(userInvitations)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(userInvitations.tokenHash, tokenHash),
            isNull(userInvitations.usedAt),
            gt(userInvitations.expiresAt, new Date()),
          ),
        )
        .returning({ userId: userInvitations.userId, tenantId: userInvitations.tenantId });
      if (!inv) return null;
      const [user] = await tx.select().from(authUsers).where(eq(authUsers.id, inv.userId));
      if (!user || user.status !== 'active') return null;
      const [existing] = await tx
        .select({ id: authAccounts.id })
        .from(authAccounts)
        .where(and(eq(authAccounts.userId, inv.userId), eq(authAccounts.providerId, 'credential')));
      if (existing) return null;
      await tx.insert(authAccounts).values({
        id: randomUUID(),
        userId: inv.userId,
        accountId: inv.userId,
        providerId: 'credential',
        password: await ctx.password.hash(password),
      });
      await tx.update(authUsers).set({ emailVerified: true }).where(eq(authUsers.id, inv.userId));
      return { ...inv, email: user.email };
    });
    if (!accepted) {
      throw new BadRequestException({
        code: 'INVALID_INVITATION',
        message: 'Convite inválido, expirado ou já utilizado.',
      });
    }
    await withTenant(this.appDb.db, accepted.tenantId, (tx) =>
      recordAudit(tx, {
        tenantId: accepted.tenantId,
        actorType: 'user',
        actorId: accepted.userId,
        action: 'user.invitation_accepted',
        targetType: 'user',
        targetId: accepted.userId,
      }),
    );
    return { email: accepted.email };
  }
}
