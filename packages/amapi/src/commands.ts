// Comando do DW Solutions → Command de enterprises.devices.issueCommand (referência oficial, 2026-10-25).
import { COMMAND_TTL_HOURS, type CommandType } from '@dw/contracts';

export type AmapiCommandType =
  'LOCK' | 'REBOOT' | 'START_LOST_MODE' | 'STOP_LOST_MODE' | 'CLEAR_APP_DATA' | 'WIPE';

export const AMAPI_COMMAND: Record<CommandType, AmapiCommandType> = {
  lock: 'LOCK',
  reboot: 'REBOOT',
  start_lost_mode: 'START_LOST_MODE',
  stop_lost_mode: 'STOP_LOST_MODE',
  clear_app_data: 'CLEAR_APP_DATA',
  wipe: 'WIPE',
};

const msg = (text: string) => ({ defaultMessage: text, localizedMessages: { 'pt-BR': text } });

/**
 * Monta o corpo do issueCommand. `duration` usa a mesma validade do DW Solutions (o padrão do Google é de
 * 10 minutos — curto demais para aparelho de vendedor que passa horas sem sinal).
 */
export function toAmapiCommand(type: CommandType, params: Record<string, unknown>) {
  const base = { type: AMAPI_COMMAND[type], duration: `${COMMAND_TTL_HOURS[type] * 3600}s` };
  switch (type) {
    case 'clear_app_data':
      return { ...base, clearAppsDataParams: { packageNames: params.packageNames as string[] } };
    case 'start_lost_mode': {
      const p = params as { message: string; phone?: string };
      return {
        ...base,
        startLostModeParams: {
          lostMessage: msg(p.message),
          ...(p.phone ? { lostPhoneNumber: msg(p.phone) } : {}),
        },
      };
    }
    case 'stop_lost_mode':
      return { ...base, stopLostModeParams: {} };
    case 'wipe':
      // Campos de wipeParams (motivo, o que preservar) ficam a confirmar na referência antes de ligar.
      return { ...base, wipeParams: {} };
    default:
      return base;
  }
}
