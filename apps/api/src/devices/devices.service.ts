import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SILENT_AFTER_HOURS, type Connectivity, type DeviceManagementProvider } from '@dw/contracts';
import {
  and,
  asc,
  commandBatches,
  count,
  desc,
  deviceCommands,
  deviceEvents,
  deviceHolders,
  devices,
  enrollmentTokens,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  policies,
  recordAudit,
  sql,
  withTenant,
  type DbHandle,
  type Device,
  type ObservedState,
  type Tx,
} from '@dw/db';
import type { AuthContext } from '../auth/decorators.js';
import { APP_DB } from '../infra/infra.module.js';
import { PROVIDER } from './provider.js';

export interface DeviceListQuery {
  search?: string;
  connectivity?: Connectivity;
  manufacturer?: 'samsung' | 'motorola';
  android?: number;
  holder?: 'assigned' | 'unassigned';
  compliance?: 'compliant' | 'noncompliant' | 'unknown' | 'not_applicable';
  policy?: string;
  sort: 'name' | 'lastSeen';
  page: number;
  pageSize: number;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export function connectivityOf(lastSeenAt: Date | null, now: Date): Connectivity {
  if (!lastSeenAt) return 'unknown';
  return now.getTime() - lastSeenAt.getTime() <= SILENT_AFTER_HOURS * 3_600_000 ? 'online' : 'silent';
}

@Injectable()
export class DevicesService {
  constructor(
    @Inject(APP_DB) private readonly appDb: DbHandle,
    @Inject(PROVIDER) private readonly provider: DeviceManagementProvider,
  ) {}

  private view(d: Device, holderName: string | null, now: Date, policyName: string | null = null) {
    const o = d.observedState as ObservedState;
    return {
      id: d.id,
      displayName: d.displayName,
      manufacturer: d.manufacturer,
      model: d.model,
      androidVersion: d.androidVersion,
      securityPatch: d.securityPatch,
      managementMode: d.managementMode,
      enrollmentState: d.enrollmentState,
      holder: d.holderId ? { id: d.holderId, name: holderName } : null,
      connectivity: connectivityOf(d.lastSeenAt, now),
      lastSeenAt: d.lastSeenAt,
      battery: o.batteryPct ?? null,
      storageFree: o.storageFreePct ?? null,
      network: o.network ?? null,
      source: d.source,
      // Política desejada × aplicada (relatada pelo aparelho, com horário).
      policy: d.policyId
        ? {
            id: d.policyId,
            name: policyName,
            version: d.policyVersion,
            appliedVersion: d.appliedPolicyVersion,
            assignedAt: d.policyAssignedAt,
            reportedAt: d.policyReportedAt,
          }
        : null,
      lostModeSince: d.lostModeSince,
      compliance: {
        status: d.compliance,
        reasons: d.complianceReasons,
        evaluatedAt: d.complianceEvaluatedAt,
      },
    };
  }

  async list(a: AuthContext, q: DeviceListQuery) {
    const now = new Date();
    const cut = new Date(now.getTime() - SILENT_AFTER_HOURS * 3_600_000);
    const filters = [
      q.search
        ? or(
            ilike(devices.displayName, `%${escapeLike(q.search)}%`),
            ilike(devices.model, `%${escapeLike(q.search)}%`),
            ilike(devices.serialNumber, `%${escapeLike(q.search)}%`),
            ilike(deviceHolders.fullName, `%${escapeLike(q.search)}%`),
          )
        : undefined,
      q.connectivity === 'online' ? gte(devices.lastSeenAt, cut) : undefined,
      q.connectivity === 'silent' ? lt(devices.lastSeenAt, cut) : undefined,
      q.connectivity === 'unknown' ? isNull(devices.lastSeenAt) : undefined,
      q.manufacturer ? eq(devices.manufacturer, q.manufacturer) : undefined,
      q.android ? eq(devices.androidVersion, q.android) : undefined,
      q.holder === 'assigned' ? isNotNull(devices.holderId) : undefined,
      q.holder === 'unassigned' ? isNull(devices.holderId) : undefined,
      q.compliance ? eq(devices.compliance, q.compliance) : undefined,
      q.policy ? eq(devices.policyId, q.policy) : undefined,
    ].filter(Boolean);
    const where = filters.length ? and(...filters) : undefined;

    return withTenant(this.appDb.db, a.tenantId, async (tx) => {
      const base = () =>
        tx
          .select({ d: devices, holderName: deviceHolders.fullName, policyName: policies.name })
          .from(devices)
          .leftJoin(deviceHolders, eq(deviceHolders.id, devices.holderId))
          .leftJoin(policies, eq(policies.id, devices.policyId))
          .where(where);
      const [{ total }] = (await tx
        .select({ total: count() })
        .from(devices)
        .leftJoin(deviceHolders, eq(deviceHolders.id, devices.holderId))
        .where(where)) as [{ total: number }];
      const order =
        q.sort === 'lastSeen'
          ? [sql`${devices.lastSeenAt} desc nulls last`, asc(devices.displayName)]
          : [asc(devices.displayName)];
      const rows = await base()
        .orderBy(...order)
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize);
      return {
        items: rows.map((r) => this.view(r.d, r.holderName, now, r.policyName)),
        total,
        page: q.page,
        pageSize: q.pageSize,
        generatedAt: now,
        source: this.provider.kind,
      };
    });
  }

  async summary(a: AuthContext) {
    const now = new Date();
    const cut = new Date(now.getTime() - SILENT_AFTER_HOURS * 3_600_000);
    return withTenant(this.appDb.db, a.tenantId, async (tx) => {
      const [c] = await tx
        .select({
          total: count(),
          online: sql<number>`count(*) filter (where ${devices.lastSeenAt} >= ${cut})`.mapWith(Number),
          silent: sql<number>`count(*) filter (where ${devices.lastSeenAt} < ${cut})`.mapWith(Number),
          unknown: sql<number>`count(*) filter (where ${devices.lastSeenAt} is null)`.mapWith(Number),
          unassigned: sql<number>`count(*) filter (where ${devices.holderId} is null)`.mapWith(Number),
          noncompliant: sql<number>`count(*) filter (where ${devices.compliance} = 'noncompliant')`.mapWith(
            Number,
          ),
          complianceUnknown: sql<number>`count(*) filter (where ${devices.compliance} = 'unknown')`.mapWith(
            Number,
          ),
          noPolicy: sql<number>`count(*) filter (where ${devices.policyId} is null)`.mapWith(Number),
          policyPending:
            sql<number>`count(*) filter (where ${devices.policyId} is not null and ${devices.appliedPolicyVersion} is distinct from ${devices.policyVersion})`.mapWith(
              Number,
            ),
          lowBattery:
            sql<number>`count(*) filter (where (${devices.observedState}->'batteryPct'->>'value')::int < 15 and ${devices.lastSeenAt} >= ${cut})`.mapWith(
              Number,
            ),
        })
        .from(devices)
        .where(eq(devices.enrollmentState, 'enrolled'));
      const byManufacturer = await tx
        .select({ key: devices.manufacturer, n: count() })
        .from(devices)
        .groupBy(devices.manufacturer)
        .orderBy(desc(count()));
      const byAndroid = await tx
        .select({ key: devices.androidVersion, n: count() })
        .from(devices)
        .groupBy(devices.androidVersion)
        .orderBy(asc(devices.androidVersion));
      const [pending] = await tx
        .select({ n: count() })
        .from(enrollmentTokens)
        .where(and(isNull(enrollmentTokens.usedAt), gt(enrollmentTokens.expiresAt, now)));
      // Prioridades: sem sinal há mais tempo e bateria baixa (não é “perdido” nem “roubado”).
      const silentRows = await tx
        .select({ d: devices, holderName: deviceHolders.fullName })
        .from(devices)
        .leftJoin(deviceHolders, eq(deviceHolders.id, devices.holderId))
        .where(lt(devices.lastSeenAt, cut))
        .orderBy(asc(devices.lastSeenAt))
        .limit(5);
      // Não conformes com relatório mais recente primeiro (motivo sempre junto).
      const noncompliantRows = await tx
        .select({ d: devices, holderName: deviceHolders.fullName, policyName: policies.name })
        .from(devices)
        .leftJoin(deviceHolders, eq(deviceHolders.id, devices.holderId))
        .leftJoin(policies, eq(policies.id, devices.policyId))
        .where(eq(devices.compliance, 'noncompliant'))
        .orderBy(sql`${devices.complianceEvaluatedAt} desc nulls last`, asc(devices.displayName))
        .limit(5);
      const [cmd] = await tx
        .select({ n: count() })
        .from(deviceCommands)
        .where(
          inArray(deviceCommands.state, [
            'queued',
            'sent_to_provider',
            'provider_accepted',
            'device_acknowledged',
          ]),
        );
      const [approvals] = await tx
        .select({ n: count() })
        .from(commandBatches)
        .where(eq(commandBatches.status, 'waiting_approval'));
      const [lost] = await tx.select({ n: count() }).from(devices).where(isNotNull(devices.lostModeSince));
      return {
        counts: {
          ...c!,
          pendingEnrollments: pending?.n ?? 0,
          commandsPending: cmd?.n ?? 0,
          approvalsPending: approvals?.n ?? 0,
          lostMode: lost?.n ?? 0,
        },
        noncompliant: noncompliantRows.map((r) => this.view(r.d, r.holderName, now, r.policyName)),
        byManufacturer,
        byAndroid,
        attention: silentRows.map((r) => this.view(r.d, r.holderName, now)),
        generatedAt: now,
        source: this.provider.kind,
        silentAfterHours: SILENT_AFTER_HOURS,
      };
    });
  }

  private async findOr404(tx: Tx, id: string) {
    const [row] = await tx
      .select({ d: devices, holderName: deviceHolders.fullName, policyName: policies.name })
      .from(devices)
      .leftJoin(deviceHolders, eq(deviceHolders.id, devices.holderId))
      .leftJoin(policies, eq(policies.id, devices.policyId))
      .where(eq(devices.id, id));
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Aparelho não encontrado.' });
    return row;
  }

  async get(a: AuthContext, id: string) {
    const now = new Date();
    return withTenant(this.appDb.db, a.tenantId, async (tx) => {
      const r = await this.findOr404(tx, id);
      return {
        ...this.view(r.d, r.holderName, now, r.policyName),
        serialNumber: r.d.serialNumber,
        providerRef: r.d.providerRef,
        enrolledAt: r.d.enrolledAt,
        capabilities: this.provider.getCapabilities(),
      };
    });
  }

  async events(a: AuthContext, id: string) {
    return withTenant(this.appDb.db, a.tenantId, async (tx) => {
      await this.findOr404(tx, id);
      return tx
        .select()
        .from(deviceEvents)
        .where(eq(deviceEvents.deviceId, id))
        .orderBy(desc(deviceEvents.occurredAt))
        .limit(100);
    });
  }

  async setHolder(a: AuthContext, id: string, holderId: string | null, reason: string) {
    return withTenant(this.appDb.db, a.tenantId, async (tx) => {
      const r = await this.findOr404(tx, id);
      let holderName: string | null = null;
      if (holderId) {
        const [h] = await tx.select().from(deviceHolders).where(eq(deviceHolders.id, holderId));
        // RLS: responsável de outra empresa “não existe”.
        if (!h)
          throw new NotFoundException({ code: 'HOLDER_NOT_FOUND', message: 'Responsável não encontrado.' });
        if (h.status !== 'active') {
          throw new NotFoundException({ code: 'HOLDER_INACTIVE', message: 'Responsável desativado.' });
        }
        holderName = h.fullName;
      }
      if (r.d.holderId === holderId) return this.view(r.d, r.holderName, new Date(), r.policyName);
      const [d] = await tx.update(devices).set({ holderId }).where(eq(devices.id, id)).returning();
      await tx.insert(deviceEvents).values({
        tenantId: a.tenantId,
        deviceId: id,
        occurredAt: new Date(),
        type: holderId ? 'holder_assigned' : 'holder_removed',
        details: { holderId, holderName, previousHolderName: r.holderName, by: a.userId },
      });
      await recordAudit(tx, {
        tenantId: a.tenantId,
        actorType: 'user',
        actorId: a.userId,
        action: holderId ? 'device.holder_assign' : 'device.holder_remove',
        targetType: 'device',
        targetId: id,
        reason,
        metadata: { holderId, previousHolderId: r.d.holderId },
        requestId: a.requestId,
      });
      return this.view(d!, holderName, new Date(), r.policyName);
    });
  }

  async rename(a: AuthContext, id: string, displayName: string) {
    return withTenant(this.appDb.db, a.tenantId, async (tx) => {
      const r = await this.findOr404(tx, id);
      const [d] = await tx.update(devices).set({ displayName }).where(eq(devices.id, id)).returning();
      await recordAudit(tx, {
        tenantId: a.tenantId,
        actorType: 'user',
        actorId: a.userId,
        action: 'device.rename',
        targetType: 'device',
        targetId: id,
        metadata: { from: r.d.displayName, to: displayName },
        requestId: a.requestId,
      });
      return this.view(d!, r.holderName, new Date(), r.policyName);
    });
  }
}
