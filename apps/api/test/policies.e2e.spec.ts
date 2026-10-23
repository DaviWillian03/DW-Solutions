import type { INestApplication } from '@nestjs/common';
import { POLICY_TEMPLATES, type PolicySettings } from '@dw/contracts';
import { auditEvents, createDb, eq, withTenant } from '@dw/db';
import { createRandom, runCheckIns, seedFleetForTenant } from '@dw/simulator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Client, readyAdminFor, startApp, viewerOf } from './support.js';

let app: INestApplication;
let server: unknown;
const appDb = createDb(process.env.TEST_DATABASE_URL!, 2);
let A: Awaited<ReturnType<typeof readyAdminFor>>;
let B: Awaited<ReturnType<typeof readyAdminFor>>;
let viewer: Client;
let salesA = '';
let merchA = '';
let salesB = '';
const NOW = new Date();

const salesSettings = (): PolicySettings => structuredClone(POLICY_TEMPLATES.sales.settings);
type Item = { id: string; policy: { id: string; version: number } | null; compliance: { status: string } };

beforeAll(async () => {
  app = await startApp();
  server = app.getHttpServer();
  A = await readyAdminFor(server, 'Empresa Políticas A');
  B = await readyAdminFor(server, 'Empresa Políticas B');
  await seedFleetForTenant(appDb, A.tenantId, { devices: 50, holders: 40, rnd: createRandom(21), now: NOW });
  await seedFleetForTenant(appDb, B.tenantId, { devices: 10, holders: 8, rnd: createRandom(22), now: NOW });
  viewer = await viewerOf(server, A.c, 'leitura.politicas@exemplo.test');
  const list = (await A.c.get('/api/policies')).body as Array<{ id: string; template: string }>;
  salesA = list.find((p) => p.template === 'sales')!.id;
  merchA = list.find((p) => p.template === 'merchandising')!.id;
  salesB = ((await B.c.get('/api/policies')).body as Array<{ id: string; template: string }>).find(
    (p) => p.template === 'sales',
  )!.id;
});

afterAll(async () => {
  await app.close();
  await appDb.close();
});

describe('políticas — consulta', () => {
  it('lista Vendas e Merchandising com versão e contagem de conformidade', async () => {
    const r = await A.c.get('/api/policies');
    expect(r.status).toBe(200);
    expect(r.body.map((p: { name: string }) => p.name)).toEqual(['Merchandising', 'Vendas']);
    const total = r.body.reduce((n: number, p: { stats: { devices: number } }) => n + p.stats.devices, 0);
    expect(total).toBe(50);
    for (const p of r.body) {
      expect(p.currentVersion).toBe(1);
      const s = p.stats;
      expect(s.compliant + s.noncompliant + s.unknown).toBe(s.devices);
    }
  });

  it('perfil Leitura consulta, mas não altera nada', async () => {
    expect((await viewer.get(`/api/policies/${salesA}`)).status).toBe(200);
    const body = { baseVersion: 1, settings: salesSettings(), note: 'tentativa' };
    expect((await viewer.post(`/api/policies/${salesA}/versions`, body)).status).toBe(403);
    expect((await viewer.post(`/api/policies/${salesA}/preview`, { settings: salesSettings() })).status).toBe(
      403,
    );
    expect(
      (await viewer.post('/api/devices/policy', { deviceIds: [salesA], policyId: null, reason: 'tentativa' }))
        .status,
    ).toBe(403);
  });

  it('outra empresa recebe 404 na política, nas versões e na comparação', async () => {
    expect((await B.c.get(`/api/policies/${salesA}`)).status).toBe(404);
    expect((await B.c.get(`/api/policies/${salesA}/versions/1`)).status).toBe(404);
    expect((await B.c.get(`/api/policies/${salesA}/diff?from=1&to=1`)).status).toBe(404);
    const body = { baseVersion: 1, settings: salesSettings(), note: 'invasão' };
    expect((await B.c.post(`/api/policies/${salesA}/versions`, body)).status).toBe(404);
  });
});

describe('políticas — simulação e versões', () => {
  it('simula o impacto antes de salvar, sem alterar nada', async () => {
    const s = salesSettings();
    s.compliance.minAndroidVersion = 15;
    const r = await A.c.post(`/api/policies/${salesA}/preview`, { settings: s });
    expect(r.status).toBe(200);
    expect(r.body.estimate).toBe(true);
    expect(r.body.changes.map((c: { label: string }) => c.label)).toEqual(['Versão mínima do Android']);
    expect(r.body.impact.devices).toBeGreaterThan(0);
    expect(r.body.impact.failingByRule.min_android).toBeGreaterThan(0);
    expect(r.body.impact.newlyFailing).toBeGreaterThan(0);
    expect(r.body.impact.newlyFailingSample[0].reasons[0].code).toBe('min_android');
    expect((await A.c.get(`/api/policies/${salesA}`)).body.currentVersion).toBe(1);
  });

  it('recusa configurações inválidas ou desconhecidas e nota curta', async () => {
    const bad = { ...salesSettings(), wipeOnNonCompliance: true };
    expect((await A.c.post(`/api/policies/${salesA}/preview`, { settings: bad })).status).toBe(400);
    const s = salesSettings();
    s.screenLock.minLength = 2;
    const r = await A.c.post(`/api/policies/${salesA}/versions`, {
      baseVersion: 1,
      settings: s,
      note: 'ok ok',
    });
    expect(r.status).toBe(400);
    expect(r.body.fields[0].field).toBe('settings.screenLock.minLength');
    const n = await A.c.post(`/api/policies/${salesA}/versions`, {
      baseVersion: 1,
      settings: salesSettings(),
      note: 'x',
    });
    expect(n.status).toBe(400);
  });

  it('versão sem mudanças é recusada', async () => {
    const r = await A.c.post(`/api/policies/${salesA}/versions`, {
      baseVersion: 1,
      settings: salesSettings(),
      note: 'sem mudanças',
    });
    expect(r.status).toBe(422);
    expect(r.body.code).toBe('NO_CHANGES');
  });

  it('publica a versão 2: aparelhos passam a aguardar a aplicação, com linha do tempo e auditoria', async () => {
    const s = salesSettings();
    s.screenLock.autoLockMinutes = 5;
    const r = await A.c.post(`/api/policies/${salesA}/versions`, {
      baseVersion: 1,
      settings: s,
      note: 'Vendedores reclamaram do bloqueio rápido',
    });
    expect(r.status).toBe(201);
    expect(r.body.version).toBe(2);
    expect(r.body.devices).toBeGreaterThan(0);

    const items = (await A.c.get(`/api/devices?policy=${salesA}&pageSize=100`)).body.items as Item[];
    expect(items).toHaveLength(r.body.devices);
    for (const d of items) {
      expect(d.policy!.version).toBe(2);
      expect(d.compliance.status).toBe('unknown');
    }
    const evs = (await A.c.get(`/api/devices/${items[0]!.id}/events`)).body;
    expect(evs[0].type).toBe('policy_updated');
    const audit = await withTenant(appDb.db, A.tenantId, (tx) =>
      tx.select().from(auditEvents).where(eq(auditEvents.action, 'policy.version_create')),
    );
    expect(audit).toHaveLength(1);
    expect(audit[0]!.reason).toBe('Vendedores reclamaram do bloqueio rápido');
  });

  it('edição feita sobre versão antiga recebe conflito em vez de sobrescrever', async () => {
    const s = salesSettings();
    s.screenLock.minLength = 8;
    const r = await A.c.post(`/api/policies/${salesA}/versions`, {
      baseVersion: 1,
      settings: s,
      note: 'edição atrasada',
    });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('VERSION_CONFLICT');
    expect(r.body.currentVersion).toBe(2);
  });

  it('compara versões e mantém o histórico', async () => {
    const d = await A.c.get(`/api/policies/${salesA}/diff?from=1&to=2`);
    expect(d.body.changes).toEqual([
      {
        key: 'screenLock.autoLockMinutes',
        label: 'Bloqueio automático da tela',
        from: 'Após 2 min sem uso',
        to: 'Após 5 min sem uso',
      },
    ]);
    const p = (await A.c.get(`/api/policies/${salesA}`)).body;
    expect(p.versions.map((v: { version: number }) => v.version)).toEqual([2, 1]);
    expect(p.versions[0].note).toBe('Vendedores reclamaram do bloqueio rápido');
    expect((await A.c.get(`/api/policies/${salesA}/versions/1`)).body.settings).toEqual(salesSettings());
  });

  it('no próximo check-in o aparelho aplica a versão 2 e a conformidade volta a ser conhecida', async () => {
    const later = new Date(Date.now() + 2 * 3_600_000);
    await withTenant(appDb.db, A.tenantId, (tx) => runCheckIns(tx, A.tenantId, later, createRandom(3)));
    const items = (await A.c.get(`/api/devices?policy=${salesA}&pageSize=100`)).body.items as Array<
      Item & { policy: { appliedVersion: number | null }; lastSeenAt: string | null }
    >;
    const applied = items.filter((d) => d.policy!.appliedVersion === 2);
    expect(applied.length).toBeGreaterThan(0);
    for (const d of applied) expect(['compliant', 'noncompliant']).toContain(d.compliance.status);
    // Quem não comunicou continua “desconhecido”: nada é dado como aplicado por suposição.
    for (const d of items.filter((x) => x.policy!.appliedVersion !== 2)) {
      expect(d.compliance.status).toBe('unknown');
    }
  });
});

describe('políticas — atribuição', () => {
  it('troca a política de vários aparelhos de uma vez, de forma idempotente', async () => {
    const ids = ((await A.c.get(`/api/devices?policy=${salesA}&pageSize=5`)).body.items as Item[]).map(
      (d) => d.id,
    );
    const r = await A.c.post('/api/devices/policy', {
      deviceIds: ids,
      policyId: merchA,
      reason: 'remanejados',
    });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ changed: 5, unchanged: 0 });
    const again = await A.c.post('/api/devices/policy', {
      deviceIds: ids,
      policyId: merchA,
      reason: 'de novo',
    });
    expect(again.body).toEqual({ changed: 0, unchanged: 5 });
    const d = (await A.c.get(`/api/devices/${ids[0]}`)).body;
    expect(d.policy.name).toBe('Merchandising');
    expect(d.policy.appliedVersion).toBeNull();
    expect(d.compliance.status).toBe('unknown');
    expect(d.compliance.reasons[0].code).toBe('awaiting_device');
  });

  it('remover a política deixa o aparelho “sem política”', async () => {
    const id = ((await A.c.get(`/api/devices?policy=${merchA}&pageSize=5`)).body.items as Item[])[0]!.id;
    await A.c.post('/api/devices/policy', { deviceIds: [id], policyId: null, reason: 'aparelho de reserva' });
    const d = (await A.c.get(`/api/devices/${id}`)).body;
    expect(d.policy).toBeNull();
    expect(d.compliance.status).toBe('not_applicable');
    // (o check-in simulado do teste anterior foi “no futuro”, então não dá para usar a ordem)
    const types = ((await A.c.get(`/api/devices/${id}/events`)).body as Array<{ type: string }>).map(
      (e) => e.type,
    );
    expect(types).toContain('policy_removed');
  });

  it('recusa a operação inteira se algum aparelho for de outra empresa', async () => {
    const mine = ((await A.c.get(`/api/devices?policy=${salesA}&pageSize=5`)).body.items as Item[])[0]!.id;
    const theirs = ((await B.c.get('/api/devices?pageSize=5')).body.items as Item[])[0]!.id;
    const r = await A.c.post('/api/devices/policy', {
      deviceIds: [mine, theirs],
      policyId: merchA,
      reason: 'tentativa',
    });
    expect(r.status).toBe(404);
    expect(r.body.code).toBe('DEVICE_NOT_FOUND');
    expect((await A.c.get(`/api/devices/${mine}`)).body.policy.id).toBe(salesA);
    expect((await B.c.get(`/api/devices/${theirs}`)).body.policy.id).toBe(salesB);
  });

  it('não aceita política de outra empresa', async () => {
    const mine = ((await A.c.get('/api/devices?pageSize=5')).body.items as Item[])[0]!.id;
    const r = await A.c.post('/api/devices/policy', {
      deviceIds: [mine],
      policyId: salesB,
      reason: 'tentativa',
    });
    expect(r.status).toBe(404);
  });

  it('limita o lote a 500 aparelhos', async () => {
    const ids = Array.from({ length: 501 }, () => crypto.randomUUID());
    expect(
      (await A.c.post('/api/devices/policy', { deviceIds: ids, policyId: null, reason: 'lote' })).status,
    ).toBe(400);
  });
});

describe('conformidade na lista e na visão geral', () => {
  it('filtro “não conforme” só traz aparelhos com motivo', async () => {
    const r = await A.c.get('/api/devices?compliance=noncompliant&pageSize=100');
    expect(r.status).toBe(200);
    for (const d of r.body.items) {
      expect(d.compliance.status).toBe('noncompliant');
      expect(d.compliance.reasons.length).toBeGreaterThan(0);
      expect(d.compliance.evaluatedAt).toBeTruthy();
    }
    const s = (await A.c.get('/api/devices/summary')).body;
    expect(s.counts.noncompliant).toBe(r.body.total);
    expect(s.noncompliant.length).toBe(Math.min(5, r.body.total));
  });

  it('cadastro por QR pode levar a política; política de outra empresa é recusada', async () => {
    const ok = await A.c.post('/api/enrollments', { durationMinutes: 30, policyId: salesA });
    expect(ok.status).toBe(201);
    expect(ok.body.policy).toEqual({ id: salesA, name: 'Vendas' });
    const bad = await A.c.post('/api/enrollments', { durationMinutes: 30, policyId: salesB });
    expect(bad.status).toBe(404);
    expect(bad.body.code).toBe('POLICY_NOT_FOUND');
  });
});
