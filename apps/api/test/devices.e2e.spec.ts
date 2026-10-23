import type { INestApplication } from '@nestjs/common';
import { createDb, enrollmentTokens, eq, withTenant } from '@dw/db';
import { completeEnrollment, createRandom, seedFleetForTenant } from '@dw/simulator';
import { Queue } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { redisConnection } from '../src/infra/queue.js';
import { type Client, readyAdminFor, startApp, viewerOf } from './support.js';

let app: INestApplication;
let server: unknown;
const appDb = createDb(process.env.TEST_DATABASE_URL!, 2);
let A: Awaited<ReturnType<typeof readyAdminFor>>;
let B: Awaited<ReturnType<typeof readyAdminFor>>;
let viewer: Client;
const NOW = new Date();

beforeAll(async () => {
  app = await startApp();
  server = app.getHttpServer();
  A = await readyAdminFor(server, 'Empresa Aparelhos A');
  B = await readyAdminFor(server, 'Empresa Aparelhos B');
  await seedFleetForTenant(appDb, A.tenantId, { devices: 60, holders: 40, rnd: createRandom(11), now: NOW });
  await seedFleetForTenant(appDb, B.tenantId, { devices: 15, holders: 10, rnd: createRandom(12), now: NOW });
  viewer = await viewerOf(server, A.c, 'leitura.aparelhos@exemplo.test');
});

afterAll(async () => {
  await app.close();
  await appDb.close();
});

describe('lista de aparelhos', () => {
  it('pagina no servidor e informa origem e horário', async () => {
    const r = await A.c.get('/api/devices?pageSize=10&page=2');
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(60);
    expect(r.body.items).toHaveLength(10);
    expect(r.body.page).toBe(2);
    expect(r.body.source).toBe('simulator');
    expect(Date.parse(r.body.generatedAt)).not.toBeNaN();
  });

  it('cada empresa vê só os próprios aparelhos', async () => {
    expect((await B.c.get('/api/devices?pageSize=100')).body.total).toBe(15);
  });

  it('filtra por comunicação; desconhecido não tem telemetria inventada', async () => {
    const all = (await A.c.get('/api/devices?pageSize=100')).body.items as Array<{
      connectivity: string;
      battery: unknown;
      lastSeenAt: string | null;
    }>;
    for (const c of ['online', 'silent', 'unknown'] as const) {
      const r = await A.c.get(`/api/devices?connectivity=${c}&pageSize=100`);
      expect(r.body.total).toBe(all.filter((d) => d.connectivity === c).length);
      expect(r.body.items.every((d: { connectivity: string }) => d.connectivity === c)).toBe(true);
    }
    for (const d of all.filter((x) => x.connectivity === 'unknown')) {
      expect(d.lastSeenAt).toBeNull();
      expect(d.battery).toBeNull();
    }
  });

  it('busca por nome, sem tratar % e _ como curingas', async () => {
    const first = (await A.c.get('/api/devices?pageSize=5')).body.items[0];
    const r = await A.c.get(`/api/devices?search=${encodeURIComponent(first.displayName)}`);
    expect(r.body.items.map((d: { id: string }) => d.id)).toContain(first.id);
    expect((await A.c.get('/api/devices?search=%25')).body.total).toBe(0);
  });

  it('recusa filtros inválidos', async () => {
    expect((await A.c.get('/api/devices?connectivity=roubado')).status).toBe(400);
    expect((await A.c.get('/api/devices?pageSize=5000')).status).toBe(400);
  });

  it('resumo bate com a lista', async () => {
    const s = (await A.c.get('/api/devices/summary')).body;
    expect(s.counts.total).toBe(60);
    expect(s.counts.online + s.counts.silent + s.counts.unknown).toBe(60);
    expect(s.byManufacturer.reduce((n: number, x: { n: number }) => n + x.n, 0)).toBe(60);
    expect(s.silentAfterHours).toBe(24);
  });
});

describe('página do aparelho e responsável', () => {
  let deviceId = '';
  let holderA = '';
  let holderB = '';

  beforeAll(async () => {
    deviceId = (await A.c.get('/api/devices?holder=unassigned&pageSize=5')).body.items[0].id;
    holderA = (await A.c.get('/api/holders')).body[0].id;
    holderB = (await B.c.get('/api/holders')).body[0].id;
  });

  it('detalhe traz capacidades com classificação honesta', async () => {
    const r = await A.c.get(`/api/devices/${deviceId}`);
    expect(r.status).toBe(200);
    expect(r.body.capabilities['location.continuous'].status).toBe('unsupported');
    expect(r.body.source).toBe('simulator');
  });

  it('outra empresa recebe 404 ao abrir o aparelho ou a linha do tempo', async () => {
    expect((await B.c.get(`/api/devices/${deviceId}`)).status).toBe(404);
    expect((await B.c.get(`/api/devices/${deviceId}/events`)).status).toBe(404);
  });

  it('perfil Leitura vê o aparelho', async () => {
    expect((await viewer.get(`/api/devices/${deviceId}`)).status).toBe(200);
  });

  it('atribui responsável com motivo, registra na linha do tempo', async () => {
    const r = await A.c.patch(`/api/devices/${deviceId}/holder`, {
      holderId: holderA,
      reason: 'entrega do aparelho',
    });
    expect(r.status).toBe(200);
    expect(r.body.holder.id).toBe(holderA);
    const evs = (await A.c.get(`/api/devices/${deviceId}/events`)).body;
    expect(evs[0].type).toBe('holder_assigned');
  });

  it('não aceita responsável de outra empresa', async () => {
    const r = await A.c.patch(`/api/devices/${deviceId}/holder`, { holderId: holderB, reason: 'tentativa' });
    expect(r.status).toBe(404);
    expect(r.body.code).toBe('HOLDER_NOT_FOUND');
  });

  it('perfil Leitura não consegue trocar responsável', async () => {
    const r = await viewer.patch(`/api/devices/${deviceId}/holder`, {
      holderId: null,
      reason: 'teste leitura',
    });
    expect(r.status).toBe(403);
  });

  it('cria responsável e recusa matrícula repetida', async () => {
    const body = { fullName: 'Nova Promotora', employeeCode: 'X-900', role: 'merchandising' };
    expect((await A.c.post('/api/holders', body)).status).toBe(201);
    expect((await A.c.post('/api/holders', body)).status).toBe(409);
  });
});

describe('cadastro por QR de DEMONSTRAÇÃO', () => {
  const queue = new Queue('dw-simulador', {
    prefix: 'dw-test',
    connection: redisConnection(process.env.REDIS_URL!),
  });
  afterAll(async () => {
    await queue.close();
  });

  it('gera QR marcado como demonstração e não guarda o token em texto', async () => {
    const r = await A.c.post('/api/enrollments', {
      displayNameHint: 'Galaxy A25 · Vendas Teste',
      durationMinutes: 30,
    });
    expect(r.status).toBe(201);
    expect(r.body.warning).toBe('DEMONSTRAÇÃO — NÃO PROVISIONA DISPOSITIVO');
    expect(JSON.parse(r.body.qrPayload).aviso).toBe(r.body.warning);
    expect(r.body.status).toBe('waiting_scan');
    const [row] = await withTenant(appDb.db, A.tenantId, (tx) =>
      tx.select().from(enrollmentTokens).where(eq(enrollmentTokens.id, r.body.id)),
    );
    expect(row!.tokenHash).not.toBe(r.body.token);
    expect(JSON.stringify(row)).not.toContain(r.body.token);
    // listagens nunca devolvem o token
    expect(JSON.stringify((await A.c.get('/api/enrollments')).body)).not.toContain(r.body.token);
  });

  it('leitura simulada vira cadastro assíncrono e o token vale uma vez', async () => {
    const created = (await A.c.post('/api/enrollments', { durationMinutes: 30 })).body;
    const scan = await A.c.post('/api/enrollments/simulate-scan', { token: created.token });
    expect(scan.status).toBe(202);
    expect(scan.body.status).toBe('processing');
    expect(await queue.getJob(`enroll-${created.id}`)).toBeTruthy();

    // O worker (Fase B3) faz isto de forma assíncrona; aqui executamos a mesma função.
    const [tok] = await withTenant(appDb.db, A.tenantId, (tx) =>
      tx.select().from(enrollmentTokens).where(eq(enrollmentTokens.id, created.id)),
    );
    await withTenant(appDb.db, A.tenantId, (tx) => completeEnrollment(tx, tok!, new Date(), createRandom(5)));
    const done = (await A.c.get(`/api/enrollments/${created.id}`)).body;
    expect(done.status).toBe('enrolled');
    expect(done.deviceId).toBeTruthy();

    const again = await A.c.post('/api/enrollments/simulate-scan', { token: created.token });
    expect(again.status).toBe(400);
    expect(again.body.code).toBe('INVALID_TOKEN');
  });

  it('token de outra empresa não funciona', async () => {
    const created = (await A.c.post('/api/enrollments', { durationMinutes: 30 })).body;
    const r = await B.c.post('/api/enrollments/simulate-scan', { token: created.token });
    expect(r.status).toBe(400);
  });

  it('perfil Leitura não gera QR', async () => {
    expect((await viewer.post('/api/enrollments', { durationMinutes: 30 })).status).toBe(403);
  });
});
