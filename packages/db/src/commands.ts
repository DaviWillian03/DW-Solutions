import { FINAL_STATES, type CommandState } from '@dw/contracts';
import { eq } from 'drizzle-orm';
import type { Tx } from './client.js';
import { commandEvents, deviceCommands, tenantSettings, type DeviceCommand } from './command-schema.js';

/**
 * Muda o estado de um comando e registra a transição no histórico, na mesma transação.
 * `actor`: user:<id> · system · provider · device.
 */
export async function transitionCommand(
  tx: Tx,
  cmd: Pick<DeviceCommand, 'id' | 'tenantId'>,
  to: CommandState,
  actor: string,
  opts: { detail?: string | null; at?: Date; providerRef?: string; sendAttempts?: number } = {},
): Promise<DeviceCommand> {
  const at = opts.at ?? new Date();
  const [row] = await tx
    .update(deviceCommands)
    .set({
      state: to,
      stateDetail: opts.detail ?? null,
      finishedAt: FINAL_STATES.includes(to) ? at : null,
      ...(opts.providerRef !== undefined ? { providerRef: opts.providerRef } : {}),
      ...(opts.sendAttempts !== undefined ? { sendAttempts: opts.sendAttempts } : {}),
    })
    .where(eq(deviceCommands.id, cmd.id))
    .returning();
  await tx.insert(commandEvents).values({
    tenantId: cmd.tenantId,
    commandId: cmd.id,
    state: to,
    actor,
    detail: opts.detail ?? null,
    occurredAt: at,
  });
  return row!;
}

/** Configurações da empresa (cria com os padrões seguros se ainda não existirem). */
export async function getTenantSettings(tx: Tx, tenantId: string) {
  const [s] = await tx.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenantId));
  if (s) return s;
  const [created] = await tx.insert(tenantSettings).values({ tenantId }).onConflictDoNothing().returning();
  return created ?? (await tx.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenantId)))[0]!;
}
