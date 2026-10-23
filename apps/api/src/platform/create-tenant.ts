import { randomUUID } from 'node:crypto';
import { authUsers, eq, recordAudit, tenants, userInvitations, type DbHandle } from '@dw/db';
import { INVITATION_TTL_MS, invitationUrl, newInvitationToken } from '../users/invitation-token.js';

export interface CreateTenantInput {
  name: string;
  slug: string;
  adminName: string;
  adminEmail: string;
}

/**
 * Operação de plataforma (ADR-0005), executada com o papel dw_platform: cria a empresa, o primeiro
 * administrador e o convite dele. A plataforma não lê nenhum dado da empresa depois disso.
 */
export async function createTenantWithAdmin(
  platformDb: DbHandle,
  webOrigin: string,
  input: CreateTenantInput,
) {
  const { token, tokenHash } = newInvitationToken();
  const userId = randomUUID();
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

  const tenantId = await platformDb.db.transaction(async (tx) => {
    const [t] = await tx
      .insert(tenants)
      .values({ name: input.name, slug: input.slug })
      .returning({ id: tenants.id });
    const id = t!.id;
    await tx.insert(authUsers).values({
      id: userId,
      tenantId: id,
      name: input.adminName,
      email: input.adminEmail.trim().toLowerCase(),
      role: 'admin',
    });
    await tx
      .insert(userInvitations)
      .values({ tenantId: id, userId, tokenHash, expiresAt, createdBy: 'plataforma' });
    await recordAudit(tx, {
      tenantId: id,
      actorType: 'platform',
      actorId: 'plataforma',
      action: 'tenant.create',
    });
    await recordAudit(tx, {
      tenantId: id,
      actorType: 'platform',
      actorId: 'plataforma',
      action: 'user.invite',
      targetType: 'user',
      targetId: userId,
      metadata: { role: 'admin' },
    });
    return id;
  });

  return { tenantId, userId, inviteUrl: invitationUrl(webOrigin, token), expiresAt };
}

/** Convida um administrador para uma empresa existente (1º admin ou recuperação de acesso — ADR-0005). */
export async function inviteAdmin(
  platformDb: DbHandle,
  webOrigin: string,
  input: { tenantSlug: string; adminName: string; adminEmail: string },
) {
  const { token, tokenHash } = newInvitationToken();
  const userId = randomUUID();
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
  const tenantId = await platformDb.db.transaction(async (tx) => {
    const [t] = await tx.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, input.tenantSlug));
    if (!t) throw new Error(`Empresa "${input.tenantSlug}" não encontrada.`);
    await tx.insert(authUsers).values({
      id: userId,
      tenantId: t.id,
      name: input.adminName,
      email: input.adminEmail.trim().toLowerCase(),
      role: 'admin',
    });
    await tx
      .insert(userInvitations)
      .values({ tenantId: t.id, userId, tokenHash, expiresAt, createdBy: 'plataforma' });
    await recordAudit(tx, {
      tenantId: t.id,
      actorType: 'platform',
      actorId: 'plataforma',
      action: 'user.invite',
      targetType: 'user',
      targetId: userId,
      metadata: { role: 'admin' },
    });
    return t.id;
  });
  return { tenantId, userId, inviteUrl: invitationUrl(webOrigin, token), expiresAt };
}
