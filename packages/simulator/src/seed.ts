// Dados de DEMONSTRAÇÃO, todos fictícios (prompt-mestre §8). Idempotente por empresa.
import {
  deviceEvents,
  deviceHolders,
  devices,
  eq,
  recordAudit,
  simDevices,
  tenants,
  withTenant,
  type DbHandle,
} from '@dw/db';
import { FIRST_NAMES, LAST_NAMES } from './catalog.js';
import { buildFleet, type FleetHolder } from './fleet.js';
import { createRandom } from './random.js';

export const DEMO_TENANT = { name: 'Comercial Exemplo Ltda (fictícia)', slug: 'comercial-exemplo' };

export async function seedDemoTenant(
  platformDb: DbHandle,
  appDb: DbHandle,
  opts: { devices?: number; holders?: number; seed?: number; now?: Date } = {},
) {
  const count = opts.devices ?? 250;
  const holderCount = opts.holders ?? 220;
  const rnd = createRandom(opts.seed ?? 20261023);
  const now = opts.now ?? new Date();

  let [tenant] = await platformDb.db.select().from(tenants).where(eq(tenants.slug, DEMO_TENANT.slug));
  if (!tenant) {
    tenant = await platformDb.db.transaction(async (tx) => {
      const [t] = await tx.insert(tenants).values(DEMO_TENANT).returning();
      await recordAudit(tx, {
        tenantId: t!.id,
        actorType: 'platform',
        actorId: 'seed',
        action: 'tenant.create',
        reason: 'dados de demonstração',
      });
      return t!;
    });
  }
  const tenantId = tenant.id;

  return withTenant(appDb.db, tenantId, async (tx) => {
    const [existing] = await tx.select({ id: devices.id }).from(devices).limit(1);
    if (existing) return { tenantId, created: false, devices: 0, holders: 0 };

    // Responsáveis fictícios: ~70% vendas, ~30% merchandising.
    const names = new Set<string>();
    while (names.size < holderCount)
      names.add(`${rnd.pick(FIRST_NAMES)} ${rnd.pick(LAST_NAMES)} ${rnd.pick(LAST_NAMES)}`);
    const inserted = await tx
      .insert(deviceHolders)
      .values(
        [...names].map((fullName, i) => ({
          tenantId,
          fullName,
          employeeCode: `F${String(i + 1).padStart(4, '0')}`,
          role: rnd.chance(0.7) ? ('sales' as const) : ('merchandising' as const),
        })),
      )
      .returning({ id: deviceHolders.id, fullName: deviceHolders.fullName, role: deviceHolders.role });

    const fleet = buildFleet({ tenantId, count, holders: inserted as FleetHolder[], now, rnd });
    for (let i = 0; i < fleet.devices.length; i += 100)
      await tx.insert(devices).values(fleet.devices.slice(i, i + 100));
    for (let i = 0; i < fleet.sims.length; i += 200)
      await tx.insert(simDevices).values(fleet.sims.slice(i, i + 200));
    for (let i = 0; i < fleet.events.length; i += 200)
      await tx.insert(deviceEvents).values(fleet.events.slice(i, i + 200));
    await recordAudit(tx, {
      tenantId,
      actorType: 'system',
      actorId: 'seed',
      action: 'simulator.seed',
      metadata: { aparelhos: count, responsaveis: inserted.length, ficticio: true },
    });
    return { tenantId, created: true, devices: count, holders: inserted.length };
  });
}
