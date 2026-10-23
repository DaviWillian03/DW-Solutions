import {
  and,
  deviceEvents,
  sql,
  deviceHolders,
  devices,
  enrollmentTokens,
  eq,
  isNotNull,
  lte,
  simDevices,
  type ObservedState,
  type Tx,
} from '@dw/db';
import { observed, pickModel } from './fleet.js';
import { securityPatchFor, serialFor } from './catalog.js';
import type { Random } from './random.js';

const HOUR = 3_600_000;
const MINUTE = 60_000;
export const SILENT_AFTER_MS = 24 * HOUR;

/**
 * Um ciclo do simulador para a empresa da transação: aparelhos com check-in vencido “comunicam”.
 * Confiáveis sempre; intermitentes às vezes; silenciosos e nunca vistos, nunca.
 */
export async function runCheckIns(tx: Tx, tenantId: string, now: Date, rnd: Random, limit = 500) {
  const due = await tx
    .select({ sim: simDevices, device: devices })
    .from(simDevices)
    .innerJoin(devices, and(eq(devices.id, simDevices.deviceId), eq(devices.tenantId, simDevices.tenantId)))
    .where(
      and(
        eq(simDevices.tenantId, tenantId),
        isNotNull(simDevices.nextCheckInAt),
        lte(simDevices.nextCheckInAt, now),
        eq(devices.enrollmentState, 'enrolled'),
      ),
    )
    .limit(limit);

  let checkedIn = 0;
  for (const { sim, device } of due) {
    const comes = sim.profile === 'reliable' || (sim.profile === 'flaky' && rnd.chance(0.75));
    const nextCheckInAt = new Date(now.getTime() + rnd.int(10, 30) * MINUTE);
    if (!comes) {
      await tx.update(simDevices).set({ nextCheckInAt }).where(eq(simDevices.deviceId, sim.deviceId));
      continue;
    }
    checkedIn++;
    const prev = device.observedState as ObservedState;
    const hours = device.lastSeenAt ? (now.getTime() - device.lastSeenAt.getTime()) / HOUR : 0;
    const before = prev.batteryPct?.value ?? rnd.int(40, 100);
    const charging = rnd.chance(0.2);
    const battery = Math.max(
      1,
      Math.min(
        100,
        Math.round(charging ? before + 30 : before - sim.batteryDrainPerHour * Math.max(hours, 0.25)),
      ),
    );
    const at = now.toISOString();
    const next: ObservedState = {
      batteryPct: { value: battery, observedAt: at },
      storageFreePct: { value: prev.storageFreePct?.value ?? rnd.int(10, 60), observedAt: at },
      network: { value: prev.network?.value ?? 'mobile', observedAt: at },
    };
    await tx.update(devices).set({ lastSeenAt: now, observedState: next }).where(eq(devices.id, device.id));
    await tx.update(simDevices).set({ nextCheckInAt }).where(eq(simDevices.deviceId, sim.deviceId));

    if (device.lastSeenAt && now.getTime() - device.lastSeenAt.getTime() > SILENT_AFTER_MS) {
      await tx.insert(deviceEvents).values({
        tenantId,
        deviceId: device.id,
        occurredAt: now,
        type: 'reconnected',
        details: { offlineHours: Math.round(hours) },
      });
    }
    if (battery < 15 && before >= 15) {
      await tx.insert(deviceEvents).values({
        tenantId,
        deviceId: device.id,
        occurredAt: now,
        type: 'battery_low',
        details: { batteryPct: battery },
      });
    }
  }
  return { due: due.length, checkedIn };
}

/**
 * Simula um aparelho lendo o QR de demonstração: cria o aparelho no simulador, marca o token como
 * usado e registra a linha do tempo. Só existe no simulador — nenhum aparelho real é provisionado.
 */
export async function completeEnrollment(
  tx: Tx,
  token: typeof enrollmentTokens.$inferSelect,
  now: Date,
  rnd: Random,
) {
  const m = pickModel(rnd);
  const dedicated = token.managementMode === 'dedicated';
  let holderName: string | null = null;
  if (token.holderId) {
    const [h] = await tx
      .select({ name: deviceHolders.fullName })
      .from(deviceHolders)
      .where(eq(deviceHolders.id, token.holderId));
    holderName = h?.name ?? null;
  }
  const [device] = await tx
    .insert(devices)
    .values({
      tenantId: token.tenantId,
      displayName: token.displayNameHint?.trim() || `${m.model} · Novo`,
      manufacturer: m.manufacturer,
      model: m.model,
      androidVersion: m.android,
      securityPatch: securityPatchFor(rnd, m.android, now),
      serialNumber: serialFor(rnd, m.manufacturer),
      managementMode: token.managementMode,
      enrollmentState: 'enrolled',
      holderId: token.holderId,
      source: 'simulator',
      enrolledAt: now,
      lastSeenAt: now,
      observedState: observed(rnd, now, dedicated ? 'dedicated' : 'sales'),
    })
    .returning();
  const d = device!;
  await tx
    .update(devices)
    .set({ providerRef: `simulador/aparelhos/${d.id.slice(0, 8)}` })
    .where(eq(devices.id, d.id));
  await tx.insert(simDevices).values({
    deviceId: d.id,
    tenantId: token.tenantId,
    profile: 'reliable',
    batteryDrainPerHour: rnd.int(2, 6),
    nextCheckInAt: new Date(now.getTime() + 15 * MINUTE),
  });
  await tx
    .update(enrollmentTokens)
    .set({ usedAt: now, deviceId: d.id })
    .where(eq(enrollmentTokens.id, token.id));
  await tx.insert(deviceEvents).values({
    tenantId: token.tenantId,
    deviceId: d.id,
    occurredAt: now,
    type: 'enrolled',
    details: { mode: token.managementMode, via: 'qr_demonstracao' },
  });
  if (token.holderId) {
    await tx.insert(deviceEvents).values({
      tenantId: token.tenantId,
      deviceId: d.id,
      occurredAt: now,
      type: 'holder_assigned',
      details: { holderId: token.holderId, holderName },
    });
  }
  return d;
}

/**
 * Registra “ficou sem sinal” para aparelhos que passaram de 24 h sem comunicar e ainda não têm esse
 * evento desde a última comunicação. Sem sinal NÃO significa desligado, perdido ou roubado.
 */
export async function recordSilent(tx: Tx, tenantId: string, now: Date) {
  const cut = new Date(now.getTime() - SILENT_AFTER_MS);
  const rows = await tx.execute<{ id: string; last_seen_at: string }>(sql`
    select d.id, d.last_seen_at from devices d
    where d.tenant_id = ${tenantId} and d.enrollment_state = 'enrolled' and d.last_seen_at < ${cut}
      and not exists (
        select 1 from device_events e
        where e.tenant_id = d.tenant_id and e.device_id = d.id and e.type = 'went_silent'
          and e.occurred_at >= d.last_seen_at
      )
    limit 500`);
  for (const r of rows.rows) {
    const lastSeen = new Date(r.last_seen_at);
    await tx.insert(deviceEvents).values({
      tenantId,
      deviceId: r.id,
      occurredAt: new Date(lastSeen.getTime() + SILENT_AFTER_MS),
      type: 'went_silent',
      details: { lastSeenAt: lastSeen.toISOString() },
    });
  }
  return rows.rows.length;
}

/** De vez em quando, um aparelho silencioso volta (ex.: estava sem bateria ou fora de área). */
export async function maybeRevive(tx: Tx, tenantId: string, now: Date, rnd: Random, chance = 0.005) {
  const silent = await tx
    .select({ deviceId: simDevices.deviceId })
    .from(simDevices)
    .where(and(eq(simDevices.tenantId, tenantId), eq(simDevices.profile, 'silent')));
  let revived = 0;
  for (const s of silent) {
    if (!rnd.chance(chance)) continue;
    revived++;
    await tx
      .update(simDevices)
      .set({ profile: 'reliable', nextCheckInAt: now })
      .where(eq(simDevices.deviceId, s.deviceId));
  }
  return revived;
}
