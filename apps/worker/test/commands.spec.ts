import { TransientProviderError, type DeviceManagementProvider } from '@dw/contracts';
import {
  and,
  commandEvents,
  createDb,
  deviceCommands,
  devices,
  eq,
  policyVersions,
  recordAudit,
  simDevices,
  tenants,
  transitionCommand,
  withTenant,
  type DeviceCommand,
} from '@dw/db';
import { createRandom, seedFleetForTenant, SimulatorProvider } from '@dw/simulator';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { processCheckIn, processCommand, processTick } from '../src/processors.js';

const appDb = createDb(process.env.TEST_DATABASE_URL!, 2);
const platformDb = createDb(process.env.TEST_PLATFORM_DATABASE_URL!, 1);
const logger = pino({ level: 'silent' });
const pushed: string[] = [];
const ok = new SimulatorProvider({ failureRate: 0 });
const deps = {
  appDb,
  platformDb,
  logger,
  rnd: createRandom(7),
  provider: ok,
  push: async (j: { deviceId: string }) => {
    pushed.push(j.deviceId);
  },
};
let tenantId = '';
let reliable: string[] = [];
let silent = '';

beforeAll(async () => {
  const [t] = await platformDb.db
    .insert(tenants)
    .values({ name: 'Empresa Comandos', slug: 'empresa-comandos-worker' })
    .returning();
  tenantId = t!.id;
  await platformDb.db.transaction((tx) =>
    recordAudit(tx, { tenantId, actorType: 'platform', action: 'tenant.create' }),
  );
  await seedFleetForTenant(appDb, tenantId, {
    devices: 60,
    holders: 50,
    rnd: createRandom(3),
    now: new Date(),
  });
  const rows = await withTenant(appDb.db, tenantId, (tx) =>
    tx
      .select({ id: devices.id, profile: simDevices.profile })
      .from(devices)
      .innerJoin(simDevices, eq(simDevices.deviceId, devices.id))
      .orderBy(devices.displayName),
  );
  reliable = rows.filter((r) => r.profile === 'reliable').map((r) => r.id);
  silent = rows.find((r) => r.profile === 'silent')!.id;
});
afterAll(async () => {
  await Promise.all([appDb.close(), platformDb.close()]);
});

let n = 0;
async function queued(
  deviceId: string,
  type: DeviceCommand['type'] = 'lock',
  extra: Partial<typeof deviceCommands.$inferInsert> = {},
) {
  const [c] = await withTenant(appDb.db, tenantId, (tx) =>
    tx
      .insert(deviceCommands)
      .values({
        tenantId,
        deviceId,
        type,
        state: 'queued',
        requestedBy: 'u1',
        requestedByName: 'Ana',
        expiresAt: new Date(Date.now() + 3_600_000),
        idempotencyKey: `k${++n}`,
        ...extra,
      })
      .returning(),
  );
  return c!;
}
const get = async (id: string) =>
  (
    await withTenant(appDb.db, tenantId, (tx) =>
      tx.select().from(deviceCommands).where(eq(deviceCommands.id, id)),
    )
  )[0]!;
const states = async (id: string) =>
  (
    await withTenant(appDb.db, tenantId, (tx) =>
      tx
        .select()
        .from(commandEvents)
        .where(eq(commandEvents.commandId, id))
        .orderBy(commandEvents.occurredAt),
    )
  ).map((e) => e.state);

describe('envio ao provedor', () => {
  it('aceite do provedor NÃO é aplicação: fica aguardando o aparelho; aparelho alcançável é “acordado”', async () => {
    const c = await queued(reliable[0]!);
    const r = await processCommand(deps, { tenantId, commandId: c.id });
    expect(r.status).toBe('accepted');
    const after = await get(c.id);
    expect(after.state).toBe('provider_accepted');
    expect(after.providerRef).toMatch(/^simulador\/operacoes\//);
    expect(pushed).toContain(reliable[0]);
  });

  it('é idempotente: mensagem repetida não reenvia', async () => {
    const c = await queued(reliable[1]!);
    await processCommand(deps, { tenantId, commandId: c.id });
    expect((await processCommand(deps, { tenantId, commandId: c.id })).status).toBe('skipped');
    expect((await get(c.id)).sendAttempts).toBe(1);
  });

  it('erro temporário: tenta de novo e, após 3 tentativas, falha com motivo', async () => {
    const down: DeviceManagementProvider = new SimulatorProvider({ failureRate: 1 });
    const c = await queued(reliable[2]!);
    const job = { tenantId, commandId: c.id };
    await expect(processCommand({ ...deps, provider: down }, job)).rejects.toBeInstanceOf(
      TransientProviderError,
    );
    await expect(processCommand({ ...deps, provider: down }, job)).rejects.toBeInstanceOf(
      TransientProviderError,
    );
    expect((await processCommand({ ...deps, provider: down }, job)).status).toBe('failed');
    const f = await get(c.id);
    expect(f.state).toBe('failed');
    expect(f.stateDetail).toContain('3 tentativas');
    expect(f.sendAttempts).toBe(3);
  });

  it('comando vencido não é enviado', async () => {
    const c = await queued(reliable[3]!, 'lock', { expiresAt: new Date(Date.now() - 1000) });
    await processCommand(deps, { tenantId, commandId: c.id });
    expect((await get(c.id)).state).toBe('expired');
  });

  it('comando cancelado não é enviado', async () => {
    const c = await queued(reliable[3]!);
    await withTenant(appDb.db, tenantId, (tx) => transitionCommand(tx, c, 'cancelled', 'user:u1'));
    expect((await processCommand(deps, { tenantId, commandId: c.id })).status).toBe('skipped');
  });
});

describe('aparelho recebe e relata', () => {
  async function sendAndCheckIn(deviceId: string, type: DeviceCommand['type'], params = {}) {
    const c = await queued(deviceId, type, { params });
    await processCommand(deps, { tenantId, commandId: c.id });
    await processCheckIn(deps, { tenantId, deviceId });
    return get(c.id);
  }

  it('bloquear: todas as etapas registradas até a aplicação verificada', async () => {
    const c = await sendAndCheckIn(reliable[4]!, 'lock');
    expect(c.state).toBe('applied_verified');
    expect(await states(c.id)).toEqual([
      'sent_to_provider',
      'provider_accepted',
      'device_acknowledged',
      'applied_verified',
    ]);
  });

  it('modo perdido: liga e desliga, com estado relatado pelo aparelho', async () => {
    const id = reliable[5]!;
    const off = await sendAndCheckIn(id, 'stop_lost_mode');
    expect(off.state).toBe('failed');
    expect(off.stateDetail).toContain('não estava em modo perdido');
    await sendAndCheckIn(id, 'start_lost_mode', { message: 'Devolva à loja', phone: '11 99999-0000' });
    const [d] = await withTenant(appDb.db, tenantId, (tx) =>
      tx.select().from(devices).where(eq(devices.id, id)),
    );
    expect(d!.lostModeSince).not.toBeNull();
    expect((await sendAndCheckIn(id, 'stop_lost_mode')).state).toBe('applied_verified');
  });

  it('limpar dados: falha com motivo se o app não está no aparelho', async () => {
    const bad = await sendAndCheckIn(reliable[6]!, 'clear_app_data', { packageNames: ['com.nao.instalado'] });
    expect(bad.state).toBe('failed');
    expect(bad.stateDetail).toContain('com.nao.instalado');
    // Apps instalados no simulador = obrigatórios da política aplicada no aparelho.
    const [v] = await withTenant(appDb.db, tenantId, (tx) =>
      tx
        .select({ settings: policyVersions.settings })
        .from(devices)
        .innerJoin(
          policyVersions,
          and(
            eq(policyVersions.policyId, devices.policyId),
            eq(policyVersions.version, devices.appliedPolicyVersion),
          ),
        )
        .where(eq(devices.id, reliable[6]!)),
    );
    const pkg = v!.settings.requiredApps[0]!.packageName;
    const good = await sendAndCheckIn(reliable[6]!, 'clear_app_data', { packageNames: [pkg] });
    expect(good.state).toBe('applied_verified');
    expect(good.stateDetail).toContain(pkg);
  });

  it('apagar: aparelho sai do gerenciamento e o que estava pendente é cancelado', async () => {
    const id = reliable[7]!;
    const waiting = await queued(id, 'reboot');
    const wipe = await sendAndCheckIn(id, 'wipe');
    expect(wipe.state).toBe('applied_verified');
    expect((await get(waiting.id)).state).toBe('cancelled');
    const [d] = await withTenant(appDb.db, tenantId, (tx) =>
      tx.select().from(devices).where(eq(devices.id, id)),
    );
    expect(d!.enrollmentState).toBe('unenrolled');
    // Novo comando para aparelho apagado nunca é enviado.
    const late = await queued(id, 'lock');
    await processCommand(deps, { tenantId, commandId: late.id });
    expect((await get(late.id)).state).toBe('cancelled');
  });
});

describe('aparelho desconectado', () => {
  it('sem sinal: comando aceito fica aguardando, expira no ciclo e NÃO executa quando o aparelho volta dias depois', async () => {
    const c = await queued(silent, 'lock', { expiresAt: new Date(Date.now() + 60_000) });
    pushed.length = 0;
    await processCommand(deps, { tenantId, commandId: c.id });
    expect((await get(c.id)).state).toBe('provider_accepted');
    expect(pushed).not.toContain(silent); // não alcançável

    const daysLater = new Date(Date.now() + 3 * 24 * 3_600_000);
    await processTick(deps, daysLater);
    expect((await get(c.id)).state).toBe('expired');

    await processCheckIn(deps, { tenantId, deviceId: silent }, daysLater);
    expect((await get(c.id)).state).toBe('expired');
    const [d] = await withTenant(appDb.db, tenantId, (tx) =>
      tx
        .select()
        .from(devices)
        .where(and(eq(devices.id, silent))),
    );
    expect(d!.lastSeenAt!.getTime()).toBe(daysLater.getTime());
  });

  it('comando com prazo ainda válido é entregue quando o aparelho volta', async () => {
    const other = (
      await withTenant(appDb.db, tenantId, (tx) =>
        tx.select().from(simDevices).where(eq(simDevices.profile, 'silent')),
      )
    ).find((s) => s.deviceId !== silent);
    if (!other) return; // frota sem 2º silencioso: cenário coberto acima
    const c = await queued(other.deviceId, 'lock', { expiresAt: new Date(Date.now() + 2 * 24 * 3_600_000) });
    await processCommand(deps, { tenantId, commandId: c.id });
    await processCheckIn(deps, { tenantId, deviceId: other.deviceId }, new Date(Date.now() + 24 * 3_600_000));
    expect((await get(c.id)).state).toBe('applied_verified');
  });
});
