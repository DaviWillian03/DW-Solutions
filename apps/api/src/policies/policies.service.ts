import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  awaitingDevice,
  diffPolicySettings,
  inventoryReasons,
  SILENT_AFTER_HOURS,
  type ComplianceReason,
  type PolicySettings,
} from '@dw/contracts';
import {
  and,
  asc,
  authUsers,
  count,
  desc,
  deviceEvents,
  devices,
  ensureDefaultPolicies,
  eq,
  inArray,
  policies,
  policyVersions,
  recordAudit,
  sql,
  withTenant,
  type DbHandle,
  type Tx,
} from '@dw/db';
import type { AuthContext } from '../auth/decorators.js';
import { APP_DB } from '../infra/infra.module.js';

const awaiting = (version: number): ComplianceReason[] => [awaitingDevice(version)];

@Injectable()
export class PoliciesService {
  constructor(@Inject(APP_DB) private readonly appDb: DbHandle) {}

  /** Contagens de conformidade e de aplicação por política. */
  private async stats(tx: Tx) {
    const rows = await tx
      .select({
        policyId: devices.policyId,
        devices: count(),
        compliant: sql<number>`count(*) filter (where ${devices.compliance} = 'compliant')`.mapWith(Number),
        noncompliant: sql<number>`count(*) filter (where ${devices.compliance} = 'noncompliant')`.mapWith(
          Number,
        ),
        unknown: sql<number>`count(*) filter (where ${devices.compliance} = 'unknown')`.mapWith(Number),
        pending:
          sql<number>`count(*) filter (where ${devices.appliedPolicyVersion} is distinct from ${devices.policyVersion})`.mapWith(
            Number,
          ),
      })
      .from(devices)
      .where(sql`${devices.policyId} is not null`)
      .groupBy(devices.policyId);
    const empty = { devices: 0, compliant: 0, noncompliant: 0, unknown: 0, pending: 0 };
    return (id: string) => {
      const r = rows.find((x) => x.policyId === id);
      return r ? { ...empty, ...r, policyId: undefined } : empty;
    };
  }

  private async findOr404(tx: Tx, id: string) {
    const [p] = await tx.select().from(policies).where(eq(policies.id, id));
    if (!p) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Política não encontrada.' });
    return p;
  }

  private async versionOr404(tx: Tx, policyId: string, version: number) {
    const [v] = await tx
      .select()
      .from(policyVersions)
      .where(and(eq(policyVersions.policyId, policyId), eq(policyVersions.version, version)));
    if (!v) throw new NotFoundException({ code: 'VERSION_NOT_FOUND', message: 'Versão não encontrada.' });
    return v;
  }

  async list(a: AuthContext) {
    return withTenant(this.appDb.db, a.tenantId, async (tx) => {
      await ensureDefaultPolicies(tx, a.tenantId);
      const rows = await tx
        .select({ p: policies, v: policyVersions })
        .from(policies)
        .innerJoin(
          policyVersions,
          and(eq(policyVersions.policyId, policies.id), eq(policyVersions.version, policies.currentVersion)),
        )
        .orderBy(asc(policies.name));
      const stats = await this.stats(tx);
      return rows.map(({ p, v }) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        template: p.template,
        currentVersion: p.currentVersion,
        updatedAt: v.createdAt,
        updatedByName: v.createdByName,
        settings: v.settings,
        stats: stats(p.id),
      }));
    });
  }

  async get(a: AuthContext, id: string) {
    return withTenant(this.appDb.db, a.tenantId, async (tx) => {
      const p = await this.findOr404(tx, id);
      const versions = await tx
        .select({
          version: policyVersions.version,
          note: policyVersions.note,
          createdByName: policyVersions.createdByName,
          createdAt: policyVersions.createdAt,
        })
        .from(policyVersions)
        .where(eq(policyVersions.policyId, id))
        .orderBy(desc(policyVersions.version));
      const current = await this.versionOr404(tx, id, p.currentVersion);
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        template: p.template,
        currentVersion: p.currentVersion,
        settings: current.settings,
        versions,
        stats: (await this.stats(tx))(p.id),
      };
    });
  }

  async version(a: AuthContext, id: string, version: number) {
    return withTenant(this.appDb.db, a.tenantId, async (tx) => {
      await this.findOr404(tx, id);
      const v = await this.versionOr404(tx, id, version);
      return {
        version: v.version,
        settings: v.settings,
        note: v.note,
        createdByName: v.createdByName,
        createdAt: v.createdAt,
      };
    });
  }

  async diff(a: AuthContext, id: string, from: number, to: number) {
    return withTenant(this.appDb.db, a.tenantId, async (tx) => {
      await this.findOr404(tx, id);
      const [x, y] = [await this.versionOr404(tx, id, from), await this.versionOr404(tx, id, to)];
      return { from, to, changes: diffPolicySettings(x.settings, y.settings) };
    });
  }

  /**
   * Simulação ANTES de salvar: o que muda e quantos aparelhos são afetados. Estimativa feita sobre o
   * último inventário conhecido de cada aparelho — não prova o comportamento real no aparelho.
   */
  async preview(a: AuthContext, id: string, settings: PolicySettings) {
    const now = new Date();
    return withTenant(this.appDb.db, a.tenantId, async (tx) => {
      const p = await this.findOr404(tx, id);
      const current = await this.versionOr404(tx, id, p.currentVersion);
      const assigned = await tx
        .select({
          id: devices.id,
          displayName: devices.displayName,
          androidVersion: devices.androidVersion,
          securityPatch: devices.securityPatch,
          lastSeenAt: devices.lastSeenAt,
        })
        .from(devices)
        .where(eq(devices.policyId, id))
        .orderBy(asc(devices.displayName));
      const cut = now.getTime() - SILENT_AFTER_HOURS * 3_600_000;
      const byRule = { min_android: 0, security_patch: 0 };
      const newlyFailing: Array<{ id: string; displayName: string; reasons: ComplianceReason[] }> = [];
      let resolved = 0;
      for (const d of assigned) {
        const before = new Set(inventoryReasons(current.settings, d, now).map((r) => r.code));
        const after = inventoryReasons(settings, d, now);
        for (const r of after) if (r.code in byRule) byRule[r.code as keyof typeof byRule]++;
        const fresh = after.filter((r) => !before.has(r.code));
        if (fresh.length) newlyFailing.push({ id: d.id, displayName: d.displayName, reasons: fresh });
        if (before.size > 0 && after.length === 0) resolved++;
      }
      return {
        baseVersion: p.currentVersion,
        changes: diffPolicySettings(current.settings, settings),
        impact: {
          devices: assigned.length,
          // Aparelhos sem sinal só recebem a versão nova quando voltarem a comunicar.
          silentOrUnknown: assigned.filter((d) => !d.lastSeenAt || d.lastSeenAt.getTime() < cut).length,
          failingByRule: byRule,
          newlyFailing: newlyFailing.length,
          newlyFailingSample: newlyFailing.slice(0, 10),
          resolved,
        },
        estimate: true,
        generatedAt: now,
      };
    });
  }

  /** Publica uma nova versão. Quem editou a partir de uma versão antiga recebe conflito (409). */
  async createVersion(
    a: AuthContext,
    id: string,
    input: { baseVersion: number; settings: PolicySettings; note: string },
  ) {
    const now = new Date();
    return withTenant(this.appDb.db, a.tenantId, async (tx) => {
      const [p] = await tx.select().from(policies).where(eq(policies.id, id)).for('update');
      if (!p) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Política não encontrada.' });
      if (p.currentVersion !== input.baseVersion) {
        throw new ConflictException({
          code: 'VERSION_CONFLICT',
          message: `Esta política mudou enquanto você editava (agora está na versão ${p.currentVersion}). Revise as mudanças e tente de novo.`,
          currentVersion: p.currentVersion,
        });
      }
      const current = await this.versionOr404(tx, id, p.currentVersion);
      const changes = diffPolicySettings(current.settings, input.settings);
      if (changes.length === 0) {
        throw new UnprocessableEntityException({
          code: 'NO_CHANGES',
          message: 'Nada mudou em relação à versão atual.',
        });
      }
      const [user] = await tx
        .select({ name: authUsers.name })
        .from(authUsers)
        .where(eq(authUsers.id, a.userId));
      const version = p.currentVersion + 1;
      await tx.insert(policyVersions).values({
        tenantId: a.tenantId,
        policyId: id,
        version,
        settings: input.settings,
        note: input.note,
        createdBy: a.userId,
        createdByName: user?.name ?? 'Administrador',
      });
      await tx.update(policies).set({ currentVersion: version }).where(eq(policies.id, id));
      // Aparelhos da política passam a desejar a versão nova; a conformidade fica “desconhecida” até o
      // aparelho relatar (nada é dado como aplicado por suposição).
      const affected = await tx
        .update(devices)
        .set({
          policyVersion: version,
          compliance: 'unknown',
          complianceReasons: awaiting(version),
          complianceEvaluatedAt: now,
        })
        .where(eq(devices.policyId, id))
        .returning({ id: devices.id });
      if (affected.length) {
        await tx.insert(deviceEvents).values(
          affected.map((d) => ({
            tenantId: a.tenantId,
            deviceId: d.id,
            occurredAt: now,
            type: 'policy_updated',
            details: { policyName: p.name, version, by: a.userId },
          })),
        );
      }
      await recordAudit(tx, {
        tenantId: a.tenantId,
        actorType: 'user',
        actorId: a.userId,
        action: 'policy.version_create',
        targetType: 'policy',
        targetId: id,
        reason: input.note,
        metadata: { version, mudancas: changes.length, aparelhos: affected.length },
        requestId: a.requestId,
      });
      return { version, changes, devices: affected.length };
    });
  }

  /** Define (ou remove) a política de um ou vários aparelhos. */
  async assign(a: AuthContext, input: { deviceIds: string[]; policyId: string | null; reason: string }) {
    const now = new Date();
    const ids = [...new Set(input.deviceIds)];
    return withTenant(this.appDb.db, a.tenantId, async (tx) => {
      const p = input.policyId ? await this.findOr404(tx, input.policyId) : null;
      const rows = await tx
        .select({ id: devices.id, policyId: devices.policyId })
        .from(devices)
        .where(inArray(devices.id, ids));
      // IDs de outra empresa “não existem” (RLS): a operação inteira é recusada.
      if (rows.length !== ids.length) {
        throw new NotFoundException({
          code: 'DEVICE_NOT_FOUND',
          message: 'Um ou mais aparelhos não foram encontrados.',
        });
      }
      const change = rows.filter((r) => r.policyId !== (p?.id ?? null)).map((r) => r.id);
      if (change.length) {
        await tx
          .update(devices)
          .set(
            p
              ? {
                  policyId: p.id,
                  policyVersion: p.currentVersion,
                  policyAssignedAt: now,
                  appliedPolicyVersion: null,
                  policyReport: null,
                  compliance: 'unknown',
                  complianceReasons: awaiting(p.currentVersion),
                  complianceEvaluatedAt: now,
                }
              : {
                  policyId: null,
                  policyVersion: null,
                  policyAssignedAt: now,
                  appliedPolicyVersion: null,
                  policyReport: null,
                  compliance: 'not_applicable',
                  complianceReasons: [],
                  complianceEvaluatedAt: now,
                },
          )
          .where(inArray(devices.id, change));
        await tx.insert(deviceEvents).values(
          change.map((deviceId) => ({
            tenantId: a.tenantId,
            deviceId,
            occurredAt: now,
            type: p ? 'policy_assigned' : 'policy_removed',
            details: p
              ? { policyId: p.id, policyName: p.name, version: p.currentVersion, by: a.userId }
              : { by: a.userId },
          })),
        );
        await recordAudit(tx, {
          tenantId: a.tenantId,
          actorType: 'user',
          actorId: a.userId,
          action: p ? 'device.policy_assign' : 'device.policy_remove',
          targetType: change.length === 1 ? 'device' : 'devices',
          targetId: change.length === 1 ? change[0]! : null,
          reason: input.reason,
          metadata: { policyId: p?.id ?? null, versao: p?.currentVersion ?? null, aparelhos: change },
          requestId: a.requestId,
        });
      }
      return { changed: change.length, unchanged: ids.length - change.length };
    });
  }
}
