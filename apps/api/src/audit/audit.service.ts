import { Inject, Injectable } from '@nestjs/common';
import { AUDIT_GROUPS, type DeviceManagementProvider } from '@dw/contracts';
import {
  and,
  auditEvents,
  authUsers,
  count,
  desc,
  devices,
  eq,
  gte,
  ilike,
  lt,
  or,
  policies,
  sql,
  verifyAuditChain,
  withTenant,
  type DbHandle,
} from '@dw/db';
import type { AuthContext } from '../auth/decorators.js';
import { PROVIDER } from '../devices/provider.js';
import { APP_DB } from '../infra/infra.module.js';

export interface AuditQuery {
  group?: keyof typeof AUDIT_GROUPS;
  outcome?: 'success' | 'denied' | 'failure';
  actorId?: string;
  targetId?: string;
  search?: string;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

@Injectable()
export class AuditService {
  constructor(
    @Inject(APP_DB) private readonly appDb: DbHandle,
    @Inject(PROVIDER) private readonly provider: DeviceManagementProvider,
  ) {}

  async list(a: AuthContext, q: AuditQuery) {
    const prefixes = q.group ? AUDIT_GROUPS[q.group]!.prefix : [];
    const where = and(
      prefixes.length
        ? or(...prefixes.map((p) => ilike(auditEvents.action, `${escapeLike(p)}%`)))
        : undefined,
      q.outcome ? eq(auditEvents.outcome, q.outcome) : undefined,
      q.actorId ? eq(auditEvents.actorId, q.actorId) : undefined,
      q.targetId ? eq(auditEvents.targetId, q.targetId) : undefined,
      q.search ? ilike(auditEvents.reason, `%${escapeLike(q.search)}%`) : undefined,
      q.from ? gte(auditEvents.occurredAt, q.from) : undefined,
      q.to ? lt(auditEvents.occurredAt, q.to) : undefined,
    );
    return withTenant(this.appDb.db, a.tenantId, async (tx) => {
      const [{ total }] = (await tx.select({ total: count() }).from(auditEvents).where(where)) as [
        { total: number },
      ];
      // Nomes legíveis do autor e do alvo (o registro guarda só IDs, que nunca mudam).
      const rows = await tx
        .select({
          e: auditEvents,
          actorName: authUsers.name,
          deviceName: devices.displayName,
          policyName: policies.name,
        })
        .from(auditEvents)
        .leftJoin(authUsers, eq(authUsers.id, auditEvents.actorId))
        .leftJoin(
          devices,
          and(eq(auditEvents.targetType, 'device'), sql`${devices.id}::text = ${auditEvents.targetId}`),
        )
        .leftJoin(
          policies,
          and(eq(auditEvents.targetType, 'policy'), sql`${policies.id}::text = ${auditEvents.targetId}`),
        )
        .where(where)
        .orderBy(desc(auditEvents.seq))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize);
      const actors = await tx
        .select({ id: authUsers.id, name: authUsers.name })
        .from(authUsers)
        .orderBy(authUsers.name);
      return {
        items: rows.map(({ e, actorName, deviceName, policyName }) => ({
          seq: e.seq,
          occurredAt: e.occurredAt,
          action: e.action,
          outcome: e.outcome,
          actorType: e.actorType,
          actorId: e.actorId,
          actorName:
            actorName ??
            (e.actorType === 'platform'
              ? 'Plataforma DW Solutions'
              : e.actorType === 'system'
                ? 'Sistema'
                : null),
          target: e.targetType
            ? { type: e.targetType, id: e.targetId, name: deviceName ?? policyName ?? null }
            : null,
          reason: e.reason,
          metadata: e.metadata,
          requestId: e.requestId,
          sourceIp: e.sourceIp,
        })),
        actors,
        total,
        page: q.page,
        pageSize: q.pageSize,
        generatedAt: new Date(),
        source: this.provider.kind,
      };
    });
  }

  /** Confere a cadeia de hashes: qualquer alteração ou remoção de registro aparece como problema. */
  async verify(a: AuthContext) {
    return withTenant(this.appDb.db, a.tenantId, async (tx) => {
      const problems = await verifyAuditChain(tx);
      const [{ n, last }] = (await tx
        .select({ n: count(), last: sql<number>`coalesce(max(${auditEvents.seq}), 0)`.mapWith(Number) })
        .from(auditEvents)) as [{ n: number; last: number }];
      return { ok: problems.length === 0, events: n, lastSeq: last, problems, verifiedAt: new Date() };
    });
  }
}
