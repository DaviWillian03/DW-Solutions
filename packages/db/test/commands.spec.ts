import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from '../src/client.js';
import { commandBatches, commandEvents, deviceCommands } from '../src/command-schema.js';
import { getTenantSettings, transitionCommand } from '../src/commands.js';
import { devices } from '../src/device-schema.js';
import { app, createTenant, expectPgError, platform } from './helpers.js';

const DENIED = '42501';
const FK = '23503';
const CHECK = '23514';
const a = app();
const p = platform();
let tA = '';
let tB = '';
let deviceA = '';
let deviceB = '';

const device = (tenantId: string) => ({
  tenantId,
  displayName: 'Galaxy A25 · Vendas 01',
  manufacturer: 'samsung' as const,
  model: 'Galaxy A25',
  androidVersion: 14,
});
const cmd = (
  tenantId: string,
  deviceId: string,
  extra: Partial<typeof deviceCommands.$inferInsert> = {},
) => ({
  tenantId,
  deviceId,
  type: 'lock' as const,
  state: 'queued' as const,
  requestedBy: 'u1',
  requestedByName: 'Ana',
  expiresAt: new Date(Date.now() + 3_600_000),
  ...extra,
});

beforeAll(async () => {
  tA = await createTenant(p, 'Empresa A');
  tB = await createTenant(p, 'Empresa B');
  [{ id: deviceA }] = (await withTenant(a.db, tA, (tx) =>
    tx.insert(devices).values(device(tA)).returning({ id: devices.id }),
  )) as [{ id: string }];
  [{ id: deviceB }] = (await withTenant(a.db, tB, (tx) =>
    tx.insert(devices).values(device(tB)).returning({ id: devices.id }),
  )) as [{ id: string }];
});

afterAll(async () => {
  await Promise.all([a.close(), p.close()]);
});

describe('comandos — isolamento e integridade', () => {
  it('cada empresa vê só os próprios comandos', async () => {
    await withTenant(a.db, tA, (tx) => tx.insert(deviceCommands).values(cmd(tA, deviceA)));
    await withTenant(a.db, tB, (tx) => tx.insert(deviceCommands).values(cmd(tB, deviceB)));
    const seen = await withTenant(a.db, tA, (tx) => tx.select().from(deviceCommands));
    expect(seen.every((c) => c.tenantId === tA)).toBe(true);
    expect(await a.db.select().from(deviceCommands)).toHaveLength(0);
  });

  it('não cria comando para aparelho de OUTRA empresa (FK composta)', async () => {
    await expectPgError(
      withTenant(a.db, tA, (tx) => tx.insert(deviceCommands).values(cmd(tA, deviceB))),
      FK,
    );
  });

  it('tipo, alvo e quem pediu não podem ser alterados; comandos não são apagados', async () => {
    const [c] = await withTenant(a.db, tA, (tx) =>
      tx.insert(deviceCommands).values(cmd(tA, deviceA)).returning(),
    );
    await expectPgError(
      withTenant(a.db, tA, (tx) =>
        tx.update(deviceCommands).set({ type: 'wipe' }).where(eq(deviceCommands.id, c!.id)),
      ),
      DENIED,
    );
    await expectPgError(
      withTenant(a.db, tA, (tx) =>
        tx.update(deviceCommands).set({ requestedBy: 'outro' }).where(eq(deviceCommands.id, c!.id)),
      ),
      DENIED,
    );
    await expectPgError(
      withTenant(a.db, tA, (tx) => tx.delete(deviceCommands).where(eq(deviceCommands.id, c!.id))),
      DENIED,
    );
  });

  it('transição registra histórico; estado final não volta; histórico é imutável', async () => {
    const [c] = await withTenant(a.db, tA, (tx) =>
      tx.insert(deviceCommands).values(cmd(tA, deviceA)).returning(),
    );
    const done = await withTenant(a.db, tA, async (tx) => {
      await transitionCommand(tx, c!, 'sent_to_provider', 'system');
      await transitionCommand(tx, c!, 'provider_accepted', 'provider', { providerRef: 'sim/op/1' });
      return transitionCommand(tx, c!, 'cancelled', 'user:u1', { detail: 'teste' });
    });
    expect(done.finishedAt).not.toBeNull();
    expect(done.providerRef).toBe('sim/op/1');
    const evs = await withTenant(a.db, tA, (tx) =>
      tx.select().from(commandEvents).where(eq(commandEvents.commandId, c!.id)),
    );
    expect(evs.map((e) => e.state)).toEqual(['sent_to_provider', 'provider_accepted', 'cancelled']);
    await expectPgError(
      withTenant(a.db, tA, (tx) => transitionCommand(tx, c!, 'applied_verified', 'device')),
      CHECK,
    );
    await expectPgError(
      withTenant(a.db, tA, (tx) =>
        tx.update(commandEvents).set({ detail: 'x' }).where(eq(commandEvents.commandId, c!.id)),
      ),
      DENIED,
    );
  });
});

describe('lotes e configurações', () => {
  it('quem pediu não aprova o próprio lote; decisão é única', async () => {
    const [b] = await withTenant(a.db, tA, (tx) =>
      tx
        .insert(commandBatches)
        .values({
          tenantId: tA,
          type: 'wipe',
          deviceCount: 2,
          status: 'waiting_approval',
          requestedBy: 'u1',
          requestedByName: 'Ana',
        })
        .returning(),
    );
    await expectPgError(
      withTenant(a.db, tA, (tx) =>
        tx
          .update(commandBatches)
          .set({ status: 'approved', decidedBy: 'u1', decidedByName: 'Ana' })
          .where(eq(commandBatches.id, b!.id)),
      ),
      CHECK,
    );
    await withTenant(a.db, tA, (tx) =>
      tx
        .update(commandBatches)
        .set({ status: 'rejected', decidedBy: 'u2', decidedByName: 'Bruno' })
        .where(eq(commandBatches.id, b!.id)),
    );
    await expectPgError(
      withTenant(a.db, tA, (tx) =>
        tx
          .update(commandBatches)
          .set({ status: 'approved', decidedBy: 'u3', decidedByName: 'Carla' })
          .where(eq(commandBatches.id, b!.id)),
      ),
      CHECK,
    );
  });

  it('apagar aparelhos começa desligado e cada empresa tem a sua configuração', async () => {
    const s = await withTenant(a.db, tA, (tx) => getTenantSettings(tx, tA));
    expect(s.wipeEnabled).toBe(false);
    const again = await withTenant(a.db, tA, (tx) => getTenantSettings(tx, tA));
    expect(again.tenantId).toBe(tA);
    await expectPgError(
      withTenant(a.db, tA, (tx) => getTenantSettings(tx, tB)),
      DENIED,
    );
  });
});
