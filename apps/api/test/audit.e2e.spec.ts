import type { INestApplication } from '@nestjs/common';
import { createDb } from '@dw/db';
import { createRandom, seedFleetForTenant } from '@dw/simulator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Client, readyAdminFor, startApp, viewerOf } from './support.js';

let app: INestApplication;
let server: unknown;
const appDb = createDb(process.env.TEST_DATABASE_URL!, 2);
let A: Awaited<ReturnType<typeof readyAdminFor>>;
let B: Awaited<ReturnType<typeof readyAdminFor>>;
let viewer: Client;
let deviceId = '';

type Row = {
  seq: number;
  action: string;
  outcome: string;
  actorName: string | null;
  target: { type: string; id: string; name: string | null } | null;
  reason: string | null;
};

beforeAll(async () => {
  app = await startApp();
  server = app.getHttpServer();
  A = await readyAdminFor(server, 'Empresa Auditoria A');
  B = await readyAdminFor(server, 'Empresa Auditoria B');
  await seedFleetForTenant(appDb, A.tenantId, {
    devices: 8,
    holders: 6,
    rnd: createRandom(41),
    now: new Date(),
  });
  viewer = await viewerOf(server, A.c, 'leitura.auditoria@exemplo.test');
  deviceId = (await A.c.get('/api/devices?pageSize=5')).body.items[0].id;
  await A.c.patch(`/api/devices/${deviceId}`, { displayName: 'Galaxy A25 · Auditoria 01' });
  // Tentativa negada (apagar está desligado por padrão).
  await A.c.post(`/api/devices/${deviceId}/commands`, {
    type: 'wipe',
    reason: 'teste de auditoria',
    confirmName: 'Galaxy A25 · Auditoria 01',
    mfaCode: '123456',
  });
});

afterAll(async () => {
  await app.close();
  await appDb.close();
});

describe('auditoria', () => {
  it('lista do mais recente para o mais antigo, com autor e alvo legíveis', async () => {
    const r = await A.c.get('/api/audit');
    expect(r.status).toBe(200);
    const items = r.body.items as Row[];
    expect(items.length).toBeGreaterThan(3);
    expect(items[0]!.seq).toBeGreaterThan(items[1]!.seq);
    const rename = items.find((e) => e.action === 'device.rename')!;
    expect(rename.actorName).toBe('Admin Empresa Auditoria A');
    expect(rename.target).toEqual({ type: 'device', id: deviceId, name: 'Galaxy A25 · Auditoria 01' });
    expect(items.find((e) => e.action === 'tenant.create')!.actorName).toBe('Plataforma DW Solutions');
  });

  it('tentativas negadas aparecem e podem ser filtradas', async () => {
    const r = await A.c.get('/api/audit?outcome=denied');
    const items = r.body.items as Row[];
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((e) => e.outcome === 'denied')).toBe(true);
    expect(items.some((e) => e.action === 'command.request')).toBe(true);
  });

  it('filtra por grupo, alvo, texto do motivo e período', async () => {
    const cmd = (await A.c.get('/api/audit?group=comandos')).body.items as Row[];
    expect(cmd.every((e) => e.action.startsWith('command.'))).toBe(true);
    const byTarget = (await A.c.get(`/api/audit?targetId=${deviceId}`)).body.items as Row[];
    expect(byTarget.every((e) => e.target?.id === deviceId)).toBe(true);
    expect((await A.c.get('/api/audit?search=DESLIGADO')).body.total).toBeGreaterThan(0);
    expect((await A.c.get('/api/audit?search=%25')).body.total).toBe(0);
    expect((await A.c.get('/api/audit?to=2000-01-01')).body.total).toBe(0);
    expect((await A.c.get('/api/audit?from=ontem')).status).toBe(400);
  });

  it('verificação da cadeia confirma que nada foi alterado', async () => {
    const v = await A.c.get('/api/audit/verify');
    expect(v.status).toBe(200);
    expect(v.body.ok).toBe(true);
    expect(v.body.problems).toEqual([]);
    expect(v.body.events).toBe(v.body.lastSeq);
  });

  it('cada empresa vê só a própria auditoria; perfil Leitura não acessa', async () => {
    const b = (await B.c.get('/api/audit?pageSize=100')).body.items as Row[];
    expect(b.some((e) => e.target?.id === deviceId)).toBe(false);
    expect((await viewer.get('/api/audit')).status).toBe(403);
    expect((await viewer.get('/api/audit/verify')).status).toBe(403);
  });

  it('segredos nunca aparecem na auditoria', async () => {
    const all = JSON.stringify((await A.c.get('/api/audit?pageSize=100')).body);
    expect(all).not.toContain('123456');
    expect(all).not.toContain(A.secret);
  });
});
