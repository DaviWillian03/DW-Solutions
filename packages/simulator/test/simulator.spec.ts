import { createHash } from 'node:crypto';
import {
  createDb,
  deviceEvents,
  devices,
  enrollmentTokens,
  eq,
  simDevices,
  withTenant,
  type ObservedState,
} from '@dw/db';
import { afterAll, describe, expect, it } from 'vitest';
import { completeEnrollment, runCheckIns } from '../src/engine.js';
import { buildFleet } from '../src/fleet.js';
import { DEMO_WARNING, SimulatorProvider } from '../src/provider.js';
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
});
