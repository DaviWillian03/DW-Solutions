import type { SimulatorEnrollJob } from '@dw/contracts';
import { enrollmentTokens, eq, recordAudit, tenants, withTenant, type DbHandle } from '@dw/db';
import { completeEnrollment, createRandom, maybeRevive, recordSilent, runCheckIns } from '@dw/simulator';
import type { Logger } from 'pino';

export interface Deps {
  appDb: DbHandle;
  platformDb: DbHandle;
  logger: Logger;
  rnd?: ReturnType<typeof createRandom>;
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
  const totals = { tenants: active.length, checkedIn: 0, silent: 0, revived: 0 };
  for (const { id } of active) {
    await withTenant(deps.appDb.db, id, async (tx) => {
      totals.revived += await maybeRevive(tx, id, now, rnd);
      totals.checkedIn += (await runCheckIns(tx, id, now, rnd)).checkedIn;
      totals.silent += await recordSilent(tx, id, now);
    });
  }
  deps.logger.info(totals, 'ciclo do simulador concluído');
  return totals;
}
