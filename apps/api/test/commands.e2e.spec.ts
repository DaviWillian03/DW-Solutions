import type { INestApplication } from '@nestjs/common';
import { auditEvents, createDb, deviceCommands, devices, eq, transitionCommand, withTenant } from '@dw/db';
import { createRandom, deliverCommands, seedFleetForTenant } from '@dw/simulator';
import { Queue } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { redisConnection } from '../src/infra/queue.js';
import { type Client, put, readyAdminFor, secondAdminOf, startApp, totp, viewerOf } from './support.js';

let app: INestApplication;
let server: unknown;
const appDb = createDb(process.env.TEST_DATABASE_URL!, 2);
const queue = new Queue('dw-simulador', {
  prefix: 'dw-test',
  connection: redisConnection(process.env.REDIS_URL!),
});
let A: Awaited<ReturnType<typeof readyAdminFor>>;
let B: Awaited<ReturnType<typeof readyAdminFor>>;
let A2: Awaited<ReturnType<typeof secondAdminOf>>;
let viewer: Client;
let ids: string[] = [];
const name: Record<string, string> = {};
/**
 * Código do app autenticador em janelas diferentes (cada código só vale uma vez no step-up). Por pessoa,
 * os deslocamentos usados só crescem, para não repetir código se o teste cruzar a virada de 30 s.
 */
const code = (secret: string, offset = 0) => totp(secret, Date.now() + offset * 30_000);

beforeAll(async () => {
  app = await startApp();
  server = app.getHttpServer();
  A = await readyAdminFor(server, 'Empresa Comandos A');
  B = await readyAdminFor(server, 'Empresa Comandos B');
  await seedFleetForTenant(appDb, A.tenantId, {
    devices: 30,
    holders: 25,
    rnd: createRandom(31),
    now: new Date(),
  });
  await seedFleetForTenant(appDb, B.tenantId, {
    devices: 5,
    holders: 5,
    rnd: createRandom(32),
    now: new Date(),
  });
  viewer = await viewerOf(server, A.c, 'leitura.comandos@exemplo.test');
  A2 = await secondAdminOf(server, A.c, 'bruno.admin@exemplo.test');
  const list = (await A.c.get('/api/devices?pageSize=30&sort=name')).body.items as {
    id: string;
    displayName: string;
  }[];
  ids = list.map((d) => d.id);
  for (const d of list) name[d.id] = d.displayName;
});

afterAll(async () => {
  await app.close();
  await appDb.close();
  await queue.close();
});

const getCmd = async (id: string) =>
  (
    await withTenant(appDb.db, A.tenantId, (tx) =>
      tx.select().from(deviceCommands).where(eq(deviceCommands.id, id)),
    )
  )[0]!;

describe('comandos simples', () => {
  it('bloquear: entra na fila com histórico e tarefa para o worker; NÃO aparece como concluído', async () => {
    const r = await A.c.post(`/api/devices/${ids[0]}/commands`, { type: 'lock' });
    expect(r.status).toBe(202);
    expect(r.body.state).toBe('queued');
    expect(r.body.source).toBe('simulator');
    expect(await queue.getJob(`command-${r.body.id}`)).toBeTruthy();
    const list = (await A.c.get(`/api/devices/${ids[0]}/commands`)).body.items;
    expect(list[0].events.map((e: { state: string }) => e.state)).toEqual([
      'requested',
      'validated',
      'queued',
    ]);
    expect(list[0].events[0].actor).toBe(`user:${A.userId}`);
  });

  it('aceite do provedor ≠ aplicação: só vira “verificado” quando o aparelho relata', async () => {
    const r = await A.c.post(`/api/devices/${ids[1]}/commands`, { type: 'reboot' });
    const c = await getCmd(r.body.id);
    await withTenant(appDb.db, A.tenantId, async (tx) => {
      await transitionCommand(tx, c, 'sent_to_provider', 'system');
      await transitionCommand(tx, c, 'provider_accepted', 'provider', {
        providerRef: 'simulador/operacoes/x',
      });
    });
    expect((await A.c.get(`/api/commands?deviceId=${ids[1]}`)).body.items[0].state).toBe('provider_accepted');
    await withTenant(appDb.db, A.tenantId, (tx) => deliverCommands(tx, A.tenantId, ids[1]!, new Date()));
    const done = (await A.c.get(`/api/commands?deviceId=${ids[1]}`)).body.items[0];
    expect(done.state).toBe('applied_verified');
    expect(done.cancellable).toBe(false);
  });

  it('mesmo comando pendente não é duplicado; chave de idempotência devolve o mesmo pedido', async () => {
    const dup = await A.c.post(`/api/devices/${ids[0]}/commands`, { type: 'lock' });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('COMMAND_PENDING');
    const body = { type: 'reboot', idempotencyKey: 'chave-teste-0001' };
    const first = await A.c.post(`/api/devices/${ids[2]}/commands`, body);
    const again = await A.c.post(`/api/devices/${ids[2]}/commands`, body);
    expect(again.status).toBe(202);
    expect(again.body.id).toBe(first.body.id);
    expect(again.body.replayed).toBe(true);
    expect((await A.c.post(`/api/devices/${ids[3]}/commands`, body)).status).toBe(409);
  });

  it('modo perdido exige mensagem, motivo e o nome do aparelho', async () => {
    const base = {
      type: 'start_lost_mode',
      params: { message: 'Devolva na loja Centro' },
      reason: 'perdido na rota',
    };
    expect((await A.c.post(`/api/devices/${ids[4]}/commands`, { ...base, params: {} })).status).toBe(400);
    const wrong = await A.c.post(`/api/devices/${ids[4]}/commands`, { ...base, confirmName: 'outro' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.code).toBe('CONFIRMATION_MISMATCH');
    const noReason = await A.c.post(`/api/devices/${ids[4]}/commands`, {
      ...base,
      reason: null,
      confirmName: name[ids[4]!],
    });
    expect(noReason.body.code).toBe('REASON_REQUIRED');
    const ok = await A.c.post(`/api/devices/${ids[4]}/commands`, { ...base, confirmName: name[ids[4]!] });
    expect(ok.status).toBe(202);
  });

  it('cancelar só antes de o aparelho receber; cancelamento é auditado', async () => {
    const r = await A.c.post(`/api/devices/${ids[5]}/commands`, { type: 'lock' });
    const c = await A.c.post(`/api/commands/${r.body.id}/cancel`, { reason: 'pedido por engano' });
    expect(c.status).toBe(200);
    expect(c.body.state).toBe('cancelled');
    expect((await A.c.post(`/api/commands/${r.body.id}/cancel`, { reason: 'de novo' })).body.code).toBe(
      'NOT_CANCELLABLE',
    );
    const audit = await withTenant(appDb.db, A.tenantId, (tx) =>
      tx.select().from(auditEvents).where(eq(auditEvents.action, 'command.cancel')),
    );
    expect(audit[0]!.reason).toBe('pedido por engano');
  });

  it('perfil Leitura acompanha, mas não envia nem cancela', async () => {
    expect((await viewer.get('/api/commands')).status).toBe(200);
    expect((await viewer.post(`/api/devices/${ids[6]}/commands`, { type: 'lock' })).status).toBe(403);
    expect((await viewer.post('/api/commands/batch', { type: 'lock', deviceIds: [ids[6]] })).status).toBe(
      403,
    );
    expect((await viewer.post(`/api/devices/${ids[6]}/simulate-check-in`)).status).toBe(403);
  });
});

describe('apagar aparelho (wipe)', () => {
  it('começa desligado: pedido é recusado e a tentativa fica na auditoria', async () => {
    expect((await A.c.get('/api/settings')).body.wipeEnabled).toBe(false);
    const r = await A.c.post(`/api/devices/${ids[7]}/commands`, {
      type: 'wipe',
      reason: 'aparelho roubado',
      confirmName: name[ids[7]!],
      mfaCode: code(A.secret, -1),
    });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('WIPE_DISABLED');
    const denied = await withTenant(appDb.db, A.tenantId, (tx) =>
      tx.select().from(auditEvents).where(eq(auditEvents.outcome, 'denied')),
    );
    expect(denied.some((e) => e.action === 'command.request')).toBe(true);
  });

  it('ligar exige refazer a verificação em duas etapas; código não pode ser reaproveitado', async () => {
    const noCode = await put(server, A.c, '/api/settings', { wipeEnabled: true });
    expect(noCode.body.code).toBe('STEP_UP_REQUIRED');
    const used = code(A.secret, -1);
    const on = await put(server, A.c, '/api/settings', { wipeEnabled: true, mfaCode: used });
    expect(on.status).toBe(200);
    expect(on.body.wipeEnabled).toBe(true);
    const reuse = await A.c.post(`/api/devices/${ids[7]}/commands`, {
      type: 'wipe',
      reason: 'aparelho roubado',
      confirmName: name[ids[7]!],
      mfaCode: used,
    });
    expect(reuse.body.code).toBe('STEP_UP_REUSED');
  });

  it('1 aparelho: nome + motivo + código válido; código errado é recusado e auditado', async () => {
    const body = { type: 'wipe', reason: 'aparelho roubado', confirmName: name[ids[7]!] };
    const bad = await A.c.post(`/api/devices/${ids[7]}/commands`, { ...body, mfaCode: '000000' });
    expect(bad.body.code).toBe('STEP_UP_FAILED');
    const ok = await A.c.post(`/api/devices/${ids[7]}/commands`, { ...body, mfaCode: code(A.secret, 0) });
    expect(ok.status).toBe(202);
    expect(ok.body.type).toBe('wipe');
  });

  it('vários aparelhos: precisa de 2º administrador; quem pede não aprova', async () => {
    const targets = [ids[8]!, ids[9]!, ids[10]!];
    const missing = await A.c.post('/api/commands/batch', {
      type: 'wipe',
      deviceIds: targets,
      reason: 'loja fechada',
    });
    expect(missing.body.code).toBe('CONFIRMATION_MISMATCH');
    const r = await A.c.post('/api/commands/batch', {
      type: 'wipe',
      deviceIds: targets,
      reason: 'loja fechada',
      confirmText: 'APAGAR 3',
      mfaCode: code(A.secret, 1),
    });
    expect(r.status).toBe(202);
    expect(r.body.status).toBe('waiting_approval');
    for (const id of targets) {
      expect((await A.c.get(`/api/commands?deviceId=${id}`)).body.items[0].state).toBe('waiting_approval');
    }

    const self = await A.c.post(`/api/commands/batches/${r.body.batchId}/approve`, {
      mfaCode: code(A.secret, 1),
    });
    expect(self.status).toBe(403);
    expect(self.body.code).toBe('SAME_REQUESTER');
    const pending = (await A2.c.get('/api/commands/batches?status=waiting_approval')).body;
    expect(pending[0].canDecide).toBe(true);
    expect((await A.c.get('/api/commands/batches?status=waiting_approval')).body[0].canDecide).toBe(false);

    expect((await A2.c.post(`/api/commands/batches/${r.body.batchId}/approve`, {})).body.code).toBe(
      'STEP_UP_REQUIRED',
    );
    const ok = await A2.c.post(`/api/commands/batches/${r.body.batchId}/approve`, {
      mfaCode: code(A2.secret, 0),
      note: 'confirmado com o gerente',
    });
    expect(ok.status).toBe(200);
    expect(ok.body.queued).toBe(3);
    for (const id of targets) {
      const c = (await A.c.get(`/api/commands?deviceId=${id}`)).body.items[0];
      expect(c.state).toBe('queued');
      expect(await queue.getJob(`command-${c.id}`)).toBeTruthy();
    }
    const again = await A2.c.post(`/api/commands/batches/${r.body.batchId}/approve`, {
      mfaCode: code(A2.secret, 1),
    });
    expect(again.body.code).toBe('BATCH_NOT_PENDING');
  });

  it('pedido recusado cancela os comandos com o motivo', async () => {
    const r = await A2.c.post('/api/commands/batch', {
      type: 'wipe',
      deviceIds: [ids[11]!, ids[12]!],
      reason: 'teste de recusa',
      confirmText: 'APAGAR 2',
      mfaCode: code(A2.secret, 1),
    });
    expect(r.status).toBe(202);
    const no = await A.c.post(`/api/commands/batches/${r.body.batchId}/reject`, {
      note: 'aparelhos foram achados',
    });
    expect(no.body).toEqual({ status: 'rejected', cancelled: 2 });
    const c = (await A.c.get(`/api/commands?deviceId=${ids[11]}`)).body.items[0];
    expect(c.state).toBe('cancelled');
    expect(c.stateDetail).toContain('aparelhos foram achados');
  });
});

describe('lotes simples e simulador', () => {
  it('bloquear vários: cria um por aparelho e informa os ignorados', async () => {
    const [wiped] = await withTenant(appDb.db, A.tenantId, (tx) =>
      tx.update(devices).set({ enrollmentState: 'unenrolled' }).where(eq(devices.id, ids[13]!)).returning(),
    );
    const r = await A.c.post('/api/commands/batch', {
      type: 'lock',
      deviceIds: [ids[14], ids[15], wiped!.id],
    });
    expect(r.status).toBe(202);
    expect(r.body.status).toBe('not_required');
    expect(r.body.created).toBe(2);
    expect(r.body.skipped).toEqual([
      { deviceId: wiped!.id, deviceName: name[wiped!.id], reason: 'não está gerenciado' },
    ]);
    expect((await A.c.post(`/api/devices/${wiped!.id}/commands`, { type: 'lock' })).body.code).toBe(
      'DEVICE_NOT_MANAGED',
    );
    expect((await A.c.post(`/api/devices/${wiped!.id}/simulate-check-in`)).status).toBe(409);
  });

  it('simular comunicação agora vira tarefa para o worker', async () => {
    const r = await A.c.post(`/api/devices/${ids[16]}/simulate-check-in`);
    expect(r.status).toBe(202);
  });

  it('visão geral conta comandos pendentes e aprovações', async () => {
    const s = (await A.c.get('/api/devices/summary')).body.counts;
    expect(s.commandsPending).toBeGreaterThan(0);
    expect(s.approvalsPending).toBe(0);
  });
});

describe('isolamento e limites', () => {
  it('outra empresa não vê, não cancela, não comanda e não aprova', async () => {
    const mine = (await A.c.get('/api/commands?pending=1')).body.items[0];
    expect((await B.c.get('/api/commands')).body.items.every((c: { id: string }) => c.id !== mine.id)).toBe(
      true,
    );
    expect((await B.c.post(`/api/commands/${mine.id}/cancel`, { reason: 'invasão' })).status).toBe(404);
    expect((await B.c.post(`/api/devices/${ids[17]}/commands`, { type: 'lock' })).status).toBe(404);
    expect((await B.c.post('/api/commands/batch', { type: 'lock', deviceIds: [ids[17]] })).status).toBe(404);
    expect((await B.c.get(`/api/devices/${ids[17]}/commands`)).body.items).toHaveLength(0);
  });

  it('5 códigos errados bloqueiam o refazer MFA por 15 minutos', async () => {
    await put(server, B.c, '/api/settings', { wipeEnabled: false });
    for (let i = 0; i < 5; i++) {
      const r = await put(server, B.c, '/api/settings', { wipeEnabled: true, mfaCode: String(100000 + i) });
      expect(r.body.code).toBe('STEP_UP_FAILED');
    }
    const locked = await put(server, B.c, '/api/settings', { wipeEnabled: true, mfaCode: code(B.secret) });
    expect(locked.status).toBe(429);
    expect(locked.body.code).toBe('STEP_UP_LOCKED');
  });

  it('valida tipo e parâmetros', async () => {
    expect((await A.c.post(`/api/devices/${ids[18]}/commands`, { type: 'formatar' })).status).toBe(400);
    expect(
      (
        await A.c.post(`/api/devices/${ids[18]}/commands`, {
          type: 'clear_app_data',
          params: { packageNames: ['Não é pacote'] },
          reason: 'x x x',
          confirmName: name[ids[18]!],
        })
      ).status,
    ).toBe(400);
  });
});
