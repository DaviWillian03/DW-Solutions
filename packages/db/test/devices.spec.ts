import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from '../src/client.js';
import { deviceEvents, devices } from '../src/device-schema.js';
import { deviceHolders } from '../src/schema.js';
import { app, createTenant, expectPgError, platform } from './helpers.js';

const DENIED = '42501';
const FK = '23503';
const a = app();
const p = platform();
let tA = '';
let tB = '';
let holderB = '';
let deviceA = '';

const device = (tenantId: string, name = 'Galaxy A25 · Vendas 01') => ({
  tenantId,
  displayName: name,
  manufacturer: 'samsung' as const,
  model: 'Galaxy A25',
  androidVersion: 14,
});

beforeAll(async () => {
  tA = await createTenant(p, 'Empresa A');
  tB = await createTenant(p, 'Empresa B');
  [{ id: holderB }] = (await withTenant(a.db, tB, (tx) =>
    tx
      .insert(deviceHolders)
      .values({ tenantId: tB, fullName: 'Bia Vendedora' })
      .returning({ id: deviceHolders.id }),
  )) as [{ id: string }];
  [{ id: deviceA }] = (await withTenant(a.db, tA, (tx) =>
    tx.insert(devices).values(device(tA)).returning({ id: devices.id }),
  )) as [{ id: string }];
});

afterAll(async () => {
  await Promise.all([a.close(), p.close()]);
});

describe('aparelhos — isolamento e integridade', () => {
  it('cada empresa vê só os próprios aparelhos; sem empresa, nada', async () => {
    await withTenant(a.db, tB, (tx) => tx.insert(devices).values(device(tB, 'moto g54 · Merch 01')));
    const vistos = await withTenant(a.db, tA, (tx) => tx.select().from(devices));
    expect(vistos.map((d) => d.id)).toEqual([deviceA]);
    expect(await a.db.select().from(devices)).toHaveLength(0);
  });

  it('não liga aparelho a responsável de OUTRA empresa, mesmo sabendo o ID (FK composta)', async () => {
    await expectPgError(
      withTenant(a.db, tA, (tx) =>
        tx.update(devices).set({ holderId: holderB }).where(eq(devices.id, deviceA)),
      ),
      FK,
    );
  });

  it('não registra evento em aparelho de outra empresa', async () => {
    await expectPgError(
      withTenant(a.db, tB, (tx) =>
        tx
          .insert(deviceEvents)
          .values({ tenantId: tB, deviceId: deviceA, occurredAt: new Date(), type: 'x' }),
      ),
      FK,
    );
  });

  it('aparelhos não podem ser apagados (exclusão segura)', async () => {
    await expectPgError(
      withTenant(a.db, tA, (tx) => tx.delete(devices).where(eq(devices.id, deviceA))),
      DENIED,
    );
  });

  it('linha do tempo é somente inserção', async () => {
    await withTenant(a.db, tA, (tx) =>
      tx
        .insert(deviceEvents)
        .values({ tenantId: tA, deviceId: deviceA, occurredAt: new Date(), type: 'enrolled' }),
    );
    await expectPgError(
      withTenant(a.db, tA, (tx) => tx.execute(sql`update device_events set type = 'x'`)),
      DENIED,
    );
    await expectPgError(
      withTenant(a.db, tA, (tx) => tx.execute(sql`delete from device_events`)),
      DENIED,
    );
  });

  it('plataforma não lê aparelhos', async () => {
    await expectPgError(p.db.select().from(devices), DENIED);
  });

  it('versão do Android fora da faixa é recusada', async () => {
    await expectPgError(
      withTenant(a.db, tA, (tx) => tx.insert(devices).values({ ...device(tA), androidVersion: 3 })),
      '23514',
    );
  });
});
