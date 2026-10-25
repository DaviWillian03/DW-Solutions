// Comandos no SIMULADOR: o aparelho sintético recebe o comando quando comunica e relata o resultado.
// Só dados sintéticos são afetados — nenhum aparelho real é bloqueado, reiniciado ou apagado.
import { PENDING_STATES } from '@dw/contracts';
import {
  and,
  asc,
  commandBatches,
  deviceCommands,
  deviceEvents,
  devices,
  eq,
  inArray,
  lte,
  policyVersions,
  simDevices,
  transitionCommand,
  type DeviceCommand,
  type Tx,
} from '@dw/db';

const NOT_DELIVERED = ['waiting_approval', 'queued', 'sent_to_provider', 'provider_accepted'] as const;

async function installedApps(tx: Tx, policyId: string | null, version: number | null): Promise<Set<string>> {
  // No simulador, os apps instalados são os obrigatórios da política aplicada.
  if (!policyId || !version) return new Set();
  const [v] = await tx
    .select({ settings: policyVersions.settings })
    .from(policyVersions)
    .where(and(eq(policyVersions.policyId, policyId), eq(policyVersions.version, version)));
  return new Set(v?.settings.requiredApps.map((a) => a.packageName) ?? []);
}

async function deviceEvent(
  tx: Tx,
  c: DeviceCommand,
  now: Date,
  type: string,
  details: Record<string, unknown>,
) {
  await tx
    .insert(deviceEvents)
    .values({ tenantId: c.tenantId, deviceId: c.deviceId, occurredAt: now, type, details });
}

/**
 * O aparelho comunicou: recebe os comandos já aceitos pelo provedor (em ordem) e relata o resultado.
 * Comandos vencidos expiram em vez de serem executados atrasados.
 */
export async function deliverCommands(tx: Tx, tenantId: string, deviceId: string, now: Date) {
  const pending = await tx
    .select()
    .from(deviceCommands)
    .where(and(eq(deviceCommands.deviceId, deviceId), eq(deviceCommands.state, 'provider_accepted')))
    .orderBy(asc(deviceCommands.createdAt));
  let delivered = 0;
  for (const c of pending) {
    if (c.expiresAt <= now) {
      await transitionCommand(tx, c, 'expired', 'system', {
        at: now,
        detail: 'O aparelho só comunicou depois do prazo; o comando não foi executado.',
      });
      continue;
    }
    const [d] = await tx.select().from(devices).where(eq(devices.id, deviceId));
    if (!d || d.enrollmentState !== 'enrolled') {
      await transitionCommand(tx, c, 'cancelled', 'system', {
        at: now,
        detail: 'Aparelho não está mais gerenciado.',
      });
      continue;
    }
    delivered++;
    await transitionCommand(tx, c, 'device_acknowledged', 'device', { at: now });
    const ok = (detail: string) =>
      transitionCommand(tx, c, 'applied_verified', 'device', { at: now, detail });
    const fail = (detail: string) => transitionCommand(tx, c, 'failed', 'device', { at: now, detail });

    switch (c.type) {
      case 'lock':
        await ok('O aparelho relatou a tela bloqueada.');
        break;
      case 'reboot':
        await deviceEvent(tx, c, now, 'rebooted', {});
        await ok('O aparelho reiniciou e voltou a comunicar.');
        break;
      case 'start_lost_mode':
        await tx.update(devices).set({ lostModeSince: now }).where(eq(devices.id, deviceId));
        await deviceEvent(tx, c, now, 'lost_mode_started', {});
        await ok('O aparelho relatou o modo perdido ativo, com a mensagem na tela.');
        break;
      case 'stop_lost_mode':
        if (!d.lostModeSince) {
          await fail('O aparelho não estava em modo perdido.');
          break;
        }
        await tx.update(devices).set({ lostModeSince: null }).where(eq(devices.id, deviceId));
        await deviceEvent(tx, c, now, 'lost_mode_stopped', {});
        await ok('O aparelho relatou que saiu do modo perdido.');
        break;
      case 'locate_device':
        // Defesa em profundidade: a API já recusa dedicados (I-6).
        if (d.managementMode === 'dedicated') {
          await fail('Localizar está desligado para aparelhos dedicados (I-6).');
          break;
        }
        await deviceEvent(tx, c, now, 'located', {});
        await ok('O aparelho enviou a localização ao provedor (disponível por 24 h, só para quem pediu).');
        break;
      case 'play_lost_sound':
        await deviceEvent(tx, c, now, 'lost_sound_played', {});
        await ok('O aparelho tocou o som.');
        break;
      case 'clear_app_data': {
        const apps = await installedApps(tx, d.policyId, d.appliedPolicyVersion);
        const wanted = (c.params.packageNames as string[] | undefined) ?? [];
        const missing = wanted.filter((p) => !apps.has(p));
        if (missing.length) {
          await fail(`App não instalado no aparelho: ${missing.join(', ')}.`);
          break;
        }
        await deviceEvent(tx, c, now, 'app_data_cleared', { packageNames: wanted });
        await ok(`Dados apagados: ${wanted.join(', ')}.`);
        break;
      }
      case 'wipe': {
        // Fora do gerenciamento: sem política, conformidade “não se aplica”.
        await tx
          .update(devices)
          .set({
            enrollmentState: 'unenrolled',
            lostModeSince: null,
            policyId: null,
            policyVersion: null,
            appliedPolicyVersion: null,
            policyReport: null,
            compliance: 'not_applicable',
            complianceReasons: [],
            complianceEvaluatedAt: now,
          })
          .where(eq(devices.id, deviceId));
        await tx.update(simDevices).set({ nextCheckInAt: null }).where(eq(simDevices.deviceId, deviceId));
        await deviceEvent(tx, c, now, 'wiped', {});
        await ok('O aparelho confirmou o apagamento e saiu do gerenciamento (simulador).');
        // O que ainda estava na fila para este aparelho não tem mais destino.
        const others = await tx
          .select()
          .from(deviceCommands)
          .where(
            and(eq(deviceCommands.deviceId, deviceId), inArray(deviceCommands.state, [...PENDING_STATES])),
          );
        for (const o of others) {
          await transitionCommand(tx, o, 'cancelled', 'system', { at: now, detail: 'Aparelho apagado.' });
        }
        return delivered;
      }
    }
  }
  return delivered;
}

/** Comandos e aprovações vencidos expiram (o aparelho não recebeu a tempo / ninguém aprovou). */
export async function expireCommands(tx: Tx, tenantId: string, now: Date) {
  const stale = await tx
    .select()
    .from(deviceCommands)
    .where(
      and(
        eq(deviceCommands.tenantId, tenantId),
        inArray(deviceCommands.state, [...NOT_DELIVERED]),
        lte(deviceCommands.expiresAt, now),
      ),
    )
    .limit(1000);
  for (const c of stale) {
    await transitionCommand(tx, c, 'expired', 'system', {
      at: now,
      detail:
        c.state === 'waiting_approval'
          ? 'Ninguém aprovou dentro do prazo.'
          : 'O aparelho não comunicou dentro do prazo; o comando não foi executado.',
    });
  }
  const batches = await tx
    .update(commandBatches)
    .set({ status: 'expired', decidedAt: now })
    .where(
      and(
        eq(commandBatches.tenantId, tenantId),
        eq(commandBatches.status, 'waiting_approval'),
        lte(commandBatches.expiresAt, now),
      ),
    )
    .returning({ id: commandBatches.id });
  return { commands: stale.length, batches: batches.length };
}

/** Aparelho alcançável por notificação (empurrão) logo depois que o provedor aceita o comando? */
export function reachableNow(profile: string, chance: () => boolean): boolean {
  return profile === 'reliable' || (profile === 'flaky' && chance());
}
