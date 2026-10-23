import { createHash } from 'node:crypto';
import {
  createDb,
  deviceEvents,
  devices,
  enrollmentTokens,
  and,
  eq,
  isNotNull,
  policies,
  simDevices,
  withTenant,
  type ObservedState,
} from '@dw/db';
import { POLICY_TEMPLATES } from '@dw/contracts';
import { sql } from '@dw/db';
import { afterAll, describe, expect, it } from 'vitest';
import { completeEnrollment, runCheckIns } from '../src/engine.js';
import { buildFleet } from '../src/fleet.js';
import { DEMO_WARNING, SimulatorProvider } from '../src/provider.js';
import { simulatedReport, type PolicyRef } from '../src/policy.js';
import { createRandom } from '../src/random.js';
import { seedDemoTenant } from '../src/seed.js';

const app = createDb(process.env.TEST_DATABASE_URL!, 2);
const plat = createDb(process.env.TEST_PLATFORM_DATABASE_URL!, 1);
afterAll(async () => {
  await Promise.all([app.close(), plat.close()]);
});

const NOW = new Date('2026-10-23T12:00:00Z');

describe('frota sintética', () => {
  const holders = Array.from({ length: 200 }, (_, i) => ({
    id: `h${i}`,
    fullName: `Pessoa ${i}`,
    role: 'sales' as const,
  }));
  const fleet = buildFleet({ tenantId: 't', count: 400, holders, now: NOW, rnd: createRandom(1) });

  it('é reproduzível com a mesma semente', () => {
    const again = buildFleet({ tenantId: 't', count: 400, holders, now: NOW, rnd: createRandom(1) });
    expect(again.devices.map((d) => d.displayName)).toEqual(fleet.devices.map((d) => d.displayName));
  });

  it('tem distribuição realista: maioria comunicando, alguns sem sinal e alguns nunca vistos', () => {
    const day = 24 * 3_600_000;
    const recentes = fleet.devices.filter(
      (d) => d.lastSeenAt && NOW.getTime() - d.lastSeenAt.getTime() < day,
    ).length;
    const semSinal = fleet.devices.filter(
      (d) => d.lastSeenAt && NOW.getTime() - d.lastSeenAt.getTime() >= day,
    ).length;
    const nunca = fleet.devices.filter((d) => !d.lastSeenAt).length;
    expect(recentes / 400).toBeGreaterThan(0.85);
    expect(semSinal).toBeGreaterThan(5);
    expect(nunca).toBeGreaterThan(0);
  });

  it('aparelho nunca observado não tem telemetria inventada', () => {
    for (const d of fleet.devices.filter((x) => !x.lastSeenAt)) expect(d.observedState).toEqual({});
  });

  it('toda leitura de telemetria tem horário de observação igual à última comunicação', () => {
    for (const d of fleet.devices.filter((x) => x.lastSeenAt)) {
      const o = d.observedState as ObservedState;
      expect(o.batteryPct?.observedAt).toBe(d.lastSeenAt!.toISOString());
    }
  });

  it('só usa Samsung e Motorola com Android 12 a 15 (CP0-3)', () => {
    expect(new Set(fleet.devices.map((d) => d.manufacturer))).toEqual(new Set(['samsung', 'motorola']));
    for (const d of fleet.devices) expect(d.androidVersion).toBeGreaterThanOrEqual(12);
    for (const d of fleet.devices) expect(d.androidVersion).toBeLessThanOrEqual(15);
  });
});

describe('provedor de simulação', () => {
  it('QR de demonstração é marcado e não segue o formato do Android', async () => {
    const t = await new SimulatorProvider().createEnrollmentToken({
      tenantId: 't',
      managementMode: 'fully_managed',
      durationMinutes: 60,
    });
    expect(t.demo).toBe(true);
    expect(JSON.parse(t.qrPayload).aviso).toBe(DEMO_WARNING);
    expect(t.qrPayload).not.toContain('android.app.extra.PROVISIONING');
  });

  it('declara rastreamento contínuo como não suportado', () => {
    expect(new SimulatorProvider().getCapabilities()['location.continuous'].status).toBe('unsupported');
  });
});

describe('políticas na frota sintética', () => {
  const ref = (id: string, t: 'sales' | 'merchandising'): PolicyRef => ({
    id,
    name: POLICY_TEMPLATES[t].name,
    version: 1,
    settings: POLICY_TEMPLATES[t].settings,
  });
  const holders = Array.from({ length: 300 }, (_, i) => ({
    id: `h${i}`,
    fullName: `Pessoa ${i}`,
    role: i % 3 === 0 ? ('merchandising' as const) : ('sales' as const),
  }));
  const fleet = buildFleet({
    tenantId: 't',
    count: 300,
    holders,
    now: NOW,
    rnd: createRandom(5),
    policies: { sales: ref('pv', 'sales'), merchandising: ref('pm', 'merchandising') },
  });

  it('todo aparelho recebe uma política; promotores ficam com Merchandising', () => {
    expect(fleet.devices.every((d) => d.policyId && d.policyVersion === 1)).toBe(true);
    const merch = fleet.devices.filter(
      (d) => holders.find((h) => h.id === d.holderId)?.role === 'merchandising',
    );
    expect(merch.length).toBeGreaterThan(0);
    expect(merch.every((d) => d.policyId === 'pm')).toBe(true);
  });

  it('aparelho que nunca comunicou fica “desconhecido”, nunca “conforme” por suposição', () => {
    const never = fleet.devices.filter((d) => !d.lastSeenAt);
    expect(never.length).toBeGreaterThan(0);
    for (const d of never) {
      expect(d.compliance).toBe('unknown');
      expect(d.appliedPolicyVersion ?? null).toBeNull();
    }
  });

  it('a maioria está conforme; os não conformes sempre têm motivo e horário do relatório', () => {
    const seen = fleet.devices.filter((d) => d.lastSeenAt);
    const non = seen.filter((d) => d.compliance === 'noncompliant');
    expect(seen.filter((d) => d.compliance === 'compliant').length / seen.length).toBeGreaterThan(0.6);
    expect(non.length).toBeGreaterThan(0);
    for (const d of non) {
      expect(d.complianceReasons!.length).toBeGreaterThan(0);
      expect(d.policyReportedAt).toEqual(d.lastSeenAt);
    }
  });

  it('restrições impostas pelo gerenciador nunca aparecem como pendência do usuário', () => {
    const r = simulatedReport(POLICY_TEMPLATES.sales.settings, {
      screenLockSet: false,
      appInstallIssue: true,
    });
    expect(r.nonCompliance.map((n) => n.setting).sort()).toEqual(['required_app', 'screen_lock']);
    expect(
      simulatedReport(POLICY_TEMPLATES.sales.settings, { screenLockSet: true, appInstallIssue: false }),
    ).toEqual({
      nonCompliance: [],
    });
  });
});

describe('motor do simulador (banco real)', () => {
  it('seed cria a demonstração uma única vez', async () => {
    const r1 = await seedDemoTenant(plat, app, { devices: 60, holders: 50, now: NOW });
    const r2 = await seedDemoTenant(plat, app, { devices: 60, holders: 50, now: NOW });
    expect(r1.created).toBe(true);
    expect(r2.created).toBe(false);
    const n = await withTenant(app.db, r1.tenantId, (tx) => tx.select({ id: devices.id }).from(devices));
    expect(n).toHaveLength(60);
  });

  it('check-ins atualizam a última comunicação e respeitam aparelhos silenciosos', async () => {
    const tenantId = (await seedDemoTenant(plat, app, { devices: 60, holders: 50, now: NOW })).tenantId;
    const later = new Date(NOW.getTime() + 2 * 3_600_000);
    const r = await withTenant(app.db, tenantId, (tx) => runCheckIns(tx, tenantId, later, createRandom(7)));
    expect(r.due).toBeGreaterThan(0);
    expect(r.checkedIn).toBeGreaterThan(0);
    const rows = await withTenant(app.db, tenantId, (tx) =>
      tx
        .select({ d: devices, s: simDevices })
        .from(devices)
        .innerJoin(simDevices, eq(simDevices.deviceId, devices.id)),
    );
    for (const { d, s } of rows.filter((x) => x.s.profile === 'silent' || x.s.profile === 'never_seen')) {
      expect(d.lastSeenAt?.getTime() ?? 0).toBeLessThan(later.getTime());
      expect(s.nextCheckInAt).toBeNull();
    }
    expect(rows.some(({ d }) => d.lastSeenAt?.getTime() === later.getTime())).toBe(true);
  });

  it('cadastro simulado cria o aparelho, usa o token uma vez e registra a linha do tempo', async () => {
    const tenantId = (await seedDemoTenant(plat, app, { devices: 60, holders: 50, now: NOW })).tenantId;
    const [tok] = await withTenant(app.db, tenantId, (tx) =>
      tx
        .insert(enrollmentTokens)
        .values({
          tenantId,
          tokenHash: createHash('sha256').update('teste').digest('hex'),
          createdBy: 'teste',
          expiresAt: new Date(NOW.getTime() + 3_600_000),
          displayNameHint: 'Galaxy A25 · Vendas Teste',
        })
        .returning(),
    );
    const d = await withTenant(app.db, tenantId, (tx) => completeEnrollment(tx, tok!, NOW, createRandom(3)));
    expect(d.displayName).toBe('Galaxy A25 · Vendas Teste');
    expect(d.enrollmentState).toBe('enrolled');
    const [used] = await withTenant(app.db, tenantId, (tx) =>
      tx.select().from(enrollmentTokens).where(eq(enrollmentTokens.id, tok!.id)),
    );
    expect(used!.usedAt).not.toBeNull();
    expect(used!.deviceId).toBe(d.id);
    const evs = await withTenant(app.db, tenantId, (tx) =>
      tx.select().from(deviceEvents).where(eq(deviceEvents.deviceId, d.id)),
    );
    expect(evs.map((e) => e.type)).toContain('enrolled');
  });

  it('seed cria as políticas prontas e liga os aparelhos a elas', async () => {
    const { tenantId } = await seedDemoTenant(plat, app, { devices: 60, holders: 50, now: NOW });
    const ps = await withTenant(app.db, tenantId, (tx) => tx.select().from(policies));
    expect(ps.map((x) => x.name).sort()).toEqual(['Merchandising', 'Vendas']);
    const ds = await withTenant(app.db, tenantId, (tx) => tx.select().from(devices));
    // Só o aparelho do teste de cadastro sem política (anterior) fica sem política.
    expect(ds.filter((d) => d.policyId).length).toBeGreaterThanOrEqual(60);
  });

  it('no check-in o aparelho aplica a versão nova e relata a conformidade', async () => {
    const { tenantId } = await seedDemoTenant(plat, app, { devices: 60, holders: 50, now: NOW });
    const target = await withTenant(app.db, tenantId, async (tx) => {
      const [row] = await tx
        .select({ d: devices })
        .from(devices)
        .innerJoin(simDevices, eq(simDevices.deviceId, devices.id))
        .where(and(eq(simDevices.profile, 'reliable'), isNotNull(devices.policyId)))
        .orderBy(devices.displayName)
        .limit(1);
      const d = row!.d;
      // Simula a API: versão 2 desejada, aparelho ainda na 1.
      const [p] = await tx.select().from(policies).where(eq(policies.id, d.policyId!));
      await tx.execute(
        sql`insert into policy_versions (tenant_id, policy_id, version, settings, note, created_by, created_by_name)
            select tenant_id, policy_id, ${p!.currentVersion + 1}, settings, 'teste do simulador', 'teste', 'Teste'
            from policy_versions where policy_id = ${p!.id} and version = ${p!.currentVersion}`,
      );
      await tx
        .update(policies)
        .set({ currentVersion: p!.currentVersion + 1 })
        .where(eq(policies.id, p!.id));
      await tx
        .update(devices)
        .set({ policyVersion: p!.currentVersion + 1, compliance: 'unknown' })
        .where(eq(devices.id, d.id));
      await tx.update(simDevices).set({ nextCheckInAt: NOW }).where(eq(simDevices.deviceId, d.id));
      return { id: d.id, version: p!.currentVersion + 1 };
    });
    const later = new Date(NOW.getTime() + 60_000);
    await withTenant(app.db, tenantId, (tx) => runCheckIns(tx, tenantId, later, createRandom(9)));
    const [d] = await withTenant(app.db, tenantId, (tx) =>
      tx.select().from(devices).where(eq(devices.id, target.id)),
    );
    expect(d!.appliedPolicyVersion).toBe(target.version);
    expect(d!.policyReportedAt).toEqual(later);
    expect(['compliant', 'noncompliant']).toContain(d!.compliance);
    const evs = await withTenant(app.db, tenantId, (tx) =>
      tx.select().from(deviceEvents).where(eq(deviceEvents.deviceId, target.id)),
    );
    expect(evs.find((e) => e.type === 'policy_applied' && e.details.version === target.version)).toBeTruthy();
    expect(evs.find((e) => e.type === 'compliance_changed')).toBeTruthy();
  });

  it('cadastro com política já sai com a versão aplicada e a senha pendente', async () => {
    const { tenantId } = await seedDemoTenant(plat, app, { devices: 60, holders: 50, now: NOW });
    const d = await withTenant(app.db, tenantId, async (tx) => {
      const [p] = await tx.select().from(policies).where(eq(policies.template, 'sales'));
      const [tok] = await tx
        .insert(enrollmentTokens)
        .values({
          tenantId,
          tokenHash: createHash('sha256').update('teste-politica').digest('hex'),
          createdBy: 'teste',
          expiresAt: new Date(NOW.getTime() + 3_600_000),
          policyId: p!.id,
        })
        .returning();
      return completeEnrollment(tx, tok!, NOW, createRandom(4));
    });
    expect(d.appliedPolicyVersion).toBe(d.policyVersion);
    expect(d.compliance).toBe('noncompliant');
    expect(d.complianceReasons.map((r) => r.code)).toContain('screen_lock');
  });
});
