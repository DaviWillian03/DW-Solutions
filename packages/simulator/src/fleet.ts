import { randomUUID } from 'node:crypto';
import { evaluateCompliance } from '@dw/contracts';
import type { NewDevice, ObservedState } from '@dw/db';
import { reportedColumns, type PolicyRef } from './policy.js';
import { MODELS, type Manufacturer, securityPatchFor, serialFor } from './catalog.js';
import type { Random } from './random.js';

export type SimProfile = 'reliable' | 'flaky' | 'silent' | 'never_seen';

export interface FleetHolder {
  id: string;
  fullName: string;
  role: 'sales' | 'merchandising' | 'other';
}

export interface SimRow {
  deviceId: string;
  tenantId: string;
  profile: SimProfile;
  batteryDrainPerHour: number;
  nextCheckInAt: Date | null;
  screenLockSet: boolean;
  appInstallIssue: boolean;
}

export interface EventRow {
  tenantId: string;
  deviceId: string;
  occurredAt: Date;
  type: string;
  details: Record<string, unknown>;
}

const HOUR = 3_600_000;
const MINUTE = 60_000;

export function observed(rnd: Random, at: Date, kind: 'sales' | 'merch' | 'dedicated'): ObservedState {
  const observedAt = at.toISOString();
  return {
    batteryPct: {
      value: rnd.weighted([
        [rnd.int(60, 100), 6],
        [rnd.int(20, 59), 3],
        [rnd.int(3, 19), 1],
      ]),
      observedAt,
    },
    storageFreePct: {
      value: rnd.weighted([
        [rnd.int(25, 70), 7],
        [rnd.int(10, 24), 2],
        [rnd.int(2, 9), 1],
      ]),
      observedAt,
    },
    network: {
      value:
        kind === 'dedicated'
          ? 'wifi'
          : rnd.weighted([
              ['mobile', 6],
              ['wifi', 4],
            ] as const),
      observedAt,
    },
  };
}

export function pickModel(rnd: Random) {
  const m = rnd.weighted(MODELS.map((x) => [x, x.weight] as const));
  return { manufacturer: m.manufacturer as Manufacturer, model: m.model, android: rnd.pick(m.android) };
}

/**
 * Gera uma frota sintética com distribuições realistas (prompt-mestre §8): maioria comunicando,
 * alguns intermitentes, alguns sem sinal há dias e alguns nunca observados (estado desconhecido).
 */
export function buildFleet(opts: {
  tenantId: string;
  count: number;
  holders: FleetHolder[];
  now: Date;
  rnd: Random;
  /** Políticas prontas da empresa: Merchandising para promotores, Vendas para os demais. */
  policies?: { sales: PolicyRef; merchandising: PolicyRef };
}) {
  const { tenantId, count, holders, now, rnd, policies } = opts;
  const devices: (NewDevice & { id: string })[] = [];
  const sims: SimRow[] = [];
  const events: EventRow[] = [];
  const free = [...holders];
  const seq = { sales: 0, merchandising: 0, other: 0, reserve: 0 };

  for (let i = 0; i < count; i++) {
    const id = randomUUID();
    const m = pickModel(rnd);
    const dedicated = m.model === 'Galaxy Tab Active5';
    // ~88% dos aparelhos com responsável; o resto é reserva/estoque.
    const holder =
      free.length > 0 && rnd.chance(0.88) ? free.splice(rnd.int(0, free.length - 1), 1)[0]! : null;
    const role = holder?.role ?? 'reserve';
    const label = { sales: 'Vendas', merchandising: 'Merch', other: 'Equipe', reserve: 'Reserva' }[role];
    const n = ++seq[role];

    const profile = rnd.weighted<SimProfile>([
      ['reliable', 85],
      ['flaky', 8],
      ['silent', 5],
      ['never_seen', 2],
    ]);
    const enrolledAt = new Date(now.getTime() - rnd.int(10, 400) * 24 * HOUR);
    const patch = securityPatchFor(rnd, m.android, now);
    const lastSeenAt =
      profile === 'reliable'
        ? new Date(now.getTime() - rnd.int(1, 90) * MINUTE)
        : profile === 'flaky'
          ? new Date(now.getTime() - rnd.int(1, 20) * HOUR)
          : profile === 'silent'
            ? new Date(now.getTime() - rnd.int(26, 240) * HOUR)
            : null;

    // Traços simulados: poucos aparelhos com senha ainda não criada ou app obrigatório pendente.
    const traits = { screenLockSet: !rnd.chance(0.04), appInstallIssue: rnd.chance(0.04) };
    const policy = policies ? (role === 'merchandising' ? policies.merchandising : policies.sales) : null;
    const assignedAt = new Date(enrolledAt.getTime() + 6 * MINUTE);
    const policyColumns = !policy
      ? {}
      : lastSeenAt
        ? reportedColumns({ androidVersion: m.android, securityPatch: patch }, policy, traits, lastSeenAt)
        : (() => {
            const r = evaluateCompliance({
              policy,
              appliedVersion: null,
              report: null,
              androidVersion: m.android,
              securityPatch: patch,
              now: assignedAt,
            });
            return { compliance: r.status, complianceReasons: r.reasons, complianceEvaluatedAt: assignedAt };
          })();

    devices.push({
      id,
      tenantId,
      displayName: `${m.model} · ${label} ${String(n).padStart(3, '0')}`,
      manufacturer: m.manufacturer,
      model: m.model,
      androidVersion: m.android,
      securityPatch: patch,
      serialNumber: serialFor(rnd, m.manufacturer),
      managementMode: dedicated ? 'dedicated' : 'fully_managed',
      enrollmentState: 'enrolled',
      holderId: holder?.id ?? null,
      source: 'simulator',
      providerRef: `simulador/aparelhos/${id.slice(0, 8)}`,
      enrolledAt,
      lastSeenAt,
      observedState: lastSeenAt
        ? observed(rnd, lastSeenAt, dedicated ? 'dedicated' : role === 'merchandising' ? 'merch' : 'sales')
        : {},
      ...(policy ? { policyId: policy.id, policyVersion: policy.version, policyAssignedAt: assignedAt } : {}),
      ...policyColumns,
    });

    sims.push({
      deviceId: id,
      tenantId,
      profile,
      batteryDrainPerHour: rnd.int(2, 9),
      nextCheckInAt:
        profile === 'reliable' || profile === 'flaky'
          ? new Date(now.getTime() + rnd.int(1, 30) * MINUTE)
          : null,
      ...traits,
    });

    events.push({
      tenantId,
      deviceId: id,
      occurredAt: enrolledAt,
      type: 'enrolled',
      details: { mode: dedicated ? 'dedicated' : 'fully_managed' },
    });
    if (holder) {
      events.push({
        tenantId,
        deviceId: id,
        occurredAt: new Date(enrolledAt.getTime() + 5 * MINUTE),
        type: 'holder_assigned',
        details: { holderId: holder.id, holderName: holder.fullName },
      });
    }
    if (policy) {
      events.push({
        tenantId,
        deviceId: id,
        occurredAt: assignedAt,
        type: 'policy_assigned',
        details: { policyId: policy.id, policyName: policy.name, version: policy.version },
      });
      if (lastSeenAt) {
        events.push({
          tenantId,
          deviceId: id,
          occurredAt: new Date(assignedAt.getTime() + MINUTE),
          type: 'policy_applied',
          details: { policyName: policy.name, version: policy.version },
        });
      }
    }
    if (profile === 'silent' && lastSeenAt) {
      events.push({
        tenantId,
        deviceId: id,
        occurredAt: new Date(lastSeenAt.getTime() + 24 * HOUR),
        type: 'went_silent',
        details: { lastSeenAt: lastSeenAt.toISOString() },
      });
    }
  }
  return { devices, sims, events };
}
