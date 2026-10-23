import { createHash } from 'node:crypto';
import {
  createDb,
  deviceEvents,
  devices,
  enrollmentTokens,
  eq,
  recordAudit,
  simDevices,
  tenants,
  withTenant,
} from '@dw/db';
import { createRandom, seedFleetForTenant } from '@dw/simulator';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { processEnroll, processTick } from '../src/processors.js';

const appDb = createDb(process.env.TEST_DATABASE_URL!, 2);
const platformDb = createDb(process.env.TEST_PLATFORM_DATABASE_URL!, 1);
const logger = pino({ level: 'silent' });
const deps = { appDb, platformDb, logger, rnd: createRandom(99) };
const NOW = new Date('2026-10-23T12:00:00Z');
let tenantId = '';

beforeAll(async () => {
  const [t] = await platformDb.db
    .insert(tenants)
    .values({ name: 'Empresa Worker', slug: 'empresa-worker' })
    .returning();
  tenantId = t!.id;
  await platformDb.db.transaction((tx) =>
    recordAudit(tx, { tenantId, actorType: 'platform', action: 'tenant.create' }),
  );
  await seedFleetForTenant(appDb, tenantId, { devices: 40, holders: 30, rnd: createRandom(1), now: NOW });
});
afterAll(async () => {
  await Promise.all([appDb.close(), platformDb.close()]);
});

async function newToken(opts: { scanned?: boolean; expired?: boolean } = {}) {
  const [t] = await withTenant(appDb.db, tenantId, (tx) =>
    tx
      .insert(enrollmentTokens)
      .values({
        tenantId,
        tokenHash: createHash('sha256').update(String(Math.random())).digest('hex'),
        createdBy: 'teste',
        expiresAt: new Date(NOW.getTime() + (opts.expired ? -1 : 1) * 3_600_000),
        scanRequestedAt: opts.scanned === false ? null : NOW,
      })
      .returning(),
  );
  return t!;
}

describe('cadastro assíncrono', () => {
  it('conclui o cadastro e registra auditoria', async () => {
    const t = await newToken();
    const r = await processEnroll(deps, { tenantId, tokenId: t.id }, NOW);
    expect(r.status).toBe('enrolled');
  });

  it('é idempotente: mensagem repetida não cria segundo aparelho', async () => {
    const t = await newToken();
    const r1 = await processEnroll(deps, { tenantId, tokenId: t.id }, NOW);
    const r2 = await processEnroll(deps, { tenantId, tokenId: t.id }, NOW);
    expect(r1.status).toBe('enrolled');
    expect(r2.status).toBe('skipped');
  });

  it('ignora token sem leitura, expirado ou de outra empresa', async () => {
    expect(
      (await processEnroll(deps, { tenantId, tokenId: (await newToken({ scanned: false })).id }, NOW)).status,
    ).toBe('skipped');
    expect(
      (await processEnroll(deps, { tenantId, tokenId: (await newToken({ expired: true })).id }, NOW)).status,
    ).toBe('skipped');
    const [other] = await platformDb.db
      .insert(tenants)
      .values({ name: 'Outra', slug: 'outra-worker' })
      .returning();
    const t = await newToken();
    expect((await processEnroll(deps, { tenantId: other!.id, tokenId: t.id }, NOW)).status).toBe('skipped');
  });
});

describe('ciclo do simulador', () => {
  it('faz check-in, marca “sem sinal” uma única vez e nunca inventa comunicação de silenciosos', async () => {
    const later = new Date(NOW.getTime() + 3 * 3_600_000);
    const r1 = await processTick({ ...deps, rnd: createRandom(5) }, later);
    expect(r1.checkedIn).toBeGreaterThan(0);
    const silentEvents = () =>
      withTenant(appDb.db, tenantId, (tx) =>
        tx.select().from(deviceEvents).where(eq(deviceEvents.type, 'went_silent')),
      );
    const before = (await silentEvents()).length;
    await processTick({ ...deps, rnd: createRandom(6) }, new Date(later.getTime() + 60_000));
    // o segundo ciclo não duplica eventos para os mesmos aparelhos
    const after = await silentEvents();
    const perDevice = new Map<string, number>();
    for (const e of after)
      perDevice.set(
        `${e.deviceId}|${e.occurredAt.toISOString()}`,
        (perDevice.get(`${e.deviceId}|${e.occurredAt.toISOString()}`) ?? 0) + 1,
      );
    expect([...perDevice.values()].every((n) => n === 1)).toBe(true);
    expect(after.length).toBeGreaterThanOrEqual(before);

    const rows = await withTenant(appDb.db, tenantId, (tx) =>
      tx
        .select({ d: devices, s: simDevices })
        .from(devices)
        .innerJoin(simDevices, eq(simDevices.deviceId, devices.id)),
    );
    for (const { d } of rows.filter((x) => x.s.profile === 'never_seen')) expect(d.lastSeenAt).toBeNull();
  });
});
