import {
  COMMAND_SEND_ATTEMPTS,
  TransientProviderError,
  type CommandJob,
  type DeviceManagementProvider,
  type SimulatorCheckInJob,
  type SimulatorEnrollJob,
} from '@dw/contracts';
import {
  deviceCommands,
  devices,
  enrollmentTokens,
  eq,
  recordAudit,
  simDevices,
  tenants,
  transitionCommand,
  withTenant,
  type DbHandle,
} from '@dw/db';
import {
  completeEnrollment,
  createRandom,
  expireCommands,
  forceCheckIn,
  maybeRevive,
  reachableNow,
  recordSilent,
  runCheckIns,
  SimulatorProvider,
} from '@dw/simulator';
import type { Logger } from 'pino';

export interface Deps {
  appDb: DbHandle;
  platformDb: DbHandle;
  logger: Logger;
  rnd?: ReturnType<typeof createRandom>;
  provider?: DeviceManagementProvider;
  /** Agenda a comunicação do aparelho (no simulador, faz o papel da notificação do provedor). */
  push?: (job: SimulatorCheckInJob) => Promise<void>;
}

/**
 * Conclui o cadastro simulado. Idempotente: se o token já foi usado, expirou ou não teve leitura
 * solicitada, não faz nada (retries e mensagens duplicadas são seguros).
 */
export async function processEnroll(deps: Deps, job: SimulatorEnrollJob, now = new Date()) {
  const rnd = deps.rnd ?? createRandom(now.getTime());
  return withTenant(deps.appDb.db, job.tenantId, async (tx) => {
    const [tok] = await tx
      .select()
      .from(enrollmentTokens)
      .where(eq(enrollmentTokens.id, job.tokenId))
      .for('update');
    if (!tok || tok.usedAt || !tok.scanRequestedAt || tok.expiresAt <= now) {
      deps.logger.info({ tokenId: job.tokenId, motivo: 'ignorado' }, 'cadastro simulado não aplicável');
      return { status: 'skipped' as const };
    }
    const device = await completeEnrollment(tx, tok, now, rnd);
    await recordAudit(tx, {
      tenantId: job.tenantId,
      actorType: 'system',
      actorId: 'simulador',
      action: 'device.enrolled',
      targetType: 'device',
      targetId: device.id,
      metadata: { demo: true, enrollmentId: tok.id },
    });
    deps.logger.info({ tenantId: job.tenantId, deviceId: device.id }, 'aparelho simulado cadastrado');
    return { status: 'enrolled' as const, deviceId: device.id };
  });
}

/** Um ciclo do simulador para todas as empresas ativas. */
export async function processTick(deps: Deps, now = new Date()) {
  const rnd = deps.rnd ?? createRandom(now.getTime());
  // A plataforma só lista IDs de empresas; os dados de cada uma são acessados com RLS (dw_app).
  const active = await deps.platformDb.db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.status, 'active'));
  const totals = { tenants: active.length, checkedIn: 0, silent: 0, revived: 0, expired: 0 };
  for (const { id } of active) {
    await withTenant(deps.appDb.db, id, async (tx) => {
      totals.revived += await maybeRevive(tx, id, now, rnd);
      totals.checkedIn += (await runCheckIns(tx, id, now, rnd)).checkedIn;
      totals.silent += await recordSilent(tx, id, now);
      totals.expired += (await expireCommands(tx, id, now)).commands;
    });
  }
  deps.logger.info(totals, 'ciclo do simulador concluído');
  return totals;
}

/**
 * Envia um comando ao provedor. Idempotente: só age em comandos “na fila” ou “enviados” (retentativa).
 * Erro temporário → nova tentativa pelo BullMQ; esgotadas as tentativas, o comando falha com motivo.
 * Sucesso = aceite do PROVEDOR; a aplicação no aparelho é confirmada depois, pelo relatório dele.
 */
export async function processCommand(deps: Deps, job: CommandJob, now = new Date()) {
  const provider = deps.provider ?? new SimulatorProvider();
  const prep = await withTenant(deps.appDb.db, job.tenantId, async (tx) => {
    const [c] = await tx
      .select()
      .from(deviceCommands)
      .where(eq(deviceCommands.id, job.commandId))
      .for('update');
    if (!c || (c.state !== 'queued' && c.state !== 'sent_to_provider')) return null;
    if (c.expiresAt <= now) {
      await transitionCommand(tx, c, 'expired', 'system', { at: now, detail: 'Venceu antes do envio.' });
      return null;
    }
    const [d] = await tx.select().from(devices).where(eq(devices.id, c.deviceId));
    if (!d || d.enrollmentState !== 'enrolled') {
      await transitionCommand(tx, c, 'cancelled', 'system', {
        at: now,
        detail: 'Aparelho não está mais gerenciado.',
      });
      return null;
    }
    const attempts = c.sendAttempts + 1;
    const sent = await transitionCommand(tx, c, 'sent_to_provider', 'system', {
      at: now,
      sendAttempts: attempts,
      detail: attempts > 1 ? `Tentativa ${attempts} de ${COMMAND_SEND_ATTEMPTS}.` : null,
    });
    return { cmd: sent, deviceRef: d.providerRef };
  });
  if (!prep) return { status: 'skipped' as const };

  const { cmd } = prep;
  let providerRef: string;
  try {
    ({ providerRef } = await provider.issueCommand({
      tenantId: cmd.tenantId,
      commandId: cmd.id,
      deviceProviderRef: prep.deviceRef,
      type: cmd.type,
      params: cmd.params,
    }));
  } catch (err) {
    const transient = err instanceof TransientProviderError;
    if (transient && cmd.sendAttempts < COMMAND_SEND_ATTEMPTS) {
      deps.logger.warn(
        { commandId: cmd.id, tentativa: cmd.sendAttempts },
        'provedor indisponível; nova tentativa',
      );
      throw err;
    }
    await withTenant(deps.appDb.db, job.tenantId, async (tx) => {
      const [c] = await tx.select().from(deviceCommands).where(eq(deviceCommands.id, cmd.id)).for('update');
      if (c?.state !== 'sent_to_provider') return; // cancelado enquanto isso
      await transitionCommand(tx, c, 'failed', 'provider', {
        detail: transient
          ? `Provedor indisponível após ${COMMAND_SEND_ATTEMPTS} tentativas.`
          : 'O provedor recusou o comando.',
      });
    });
    deps.logger.error({ commandId: cmd.id, err: (err as Error).message }, 'comando falhou no envio');
    return { status: 'failed' as const };
  }

  const accepted = await withTenant(deps.appDb.db, job.tenantId, async (tx) => {
    const [c] = await tx.select().from(deviceCommands).where(eq(deviceCommands.id, cmd.id)).for('update');
    // Pode ter sido cancelado enquanto o envio acontecia.
    if (!c || c.state !== 'sent_to_provider') return null;
    await transitionCommand(tx, c, 'provider_accepted', 'provider', {
      providerRef,
      detail: 'Aguardando o aparelho comunicar.',
    });
    const [sim] = await tx.select().from(simDevices).where(eq(simDevices.deviceId, c.deviceId));
    return {
      reachable: !!sim && reachableNow(sim.profile, () => (deps.rnd ?? createRandom(Date.now())).chance(0.5)),
    };
  });
  if (!accepted) return { status: 'skipped' as const };
  if (accepted.reachable && deps.push) await deps.push({ tenantId: job.tenantId, deviceId: cmd.deviceId });
  return { status: 'accepted' as const, providerRef };
}

/** SIMULADOR: o aparelho comunica agora (notificação do provedor ou botão “simular comunicação”). */
export async function processCheckIn(deps: Deps, job: SimulatorCheckInJob, now = new Date()) {
  const rnd = deps.rnd ?? createRandom(now.getTime());
  const ok = await withTenant(deps.appDb.db, job.tenantId, (tx) =>
    forceCheckIn(tx, job.tenantId, job.deviceId, now, rnd),
  );
  return { status: ok ? ('checked_in' as const) : ('skipped' as const) };
}
