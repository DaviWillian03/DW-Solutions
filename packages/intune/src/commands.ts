// Comando do DW Solutions → ação remota do Intune (Graph v1.0, conferido em 2026-10-25; docs/android/INTUNE.md).
import {
  UnsupportedCapabilityError,
  COMMAND_CAPABILITY,
  type CommandState,
  type CommandType,
  type DeviceLocation,
} from '@dw/contracts';
import type { DeviceAction } from './client.js';

/** No Android o Intune não tem modo perdido nem limpar dados de app (I-1). */
const NOT_IN_INTUNE: Partial<Record<CommandType, string>> = {
  start_lost_mode:
    'O Intune não tem modo perdido no Android (só iPhone/iPad). Use “Localizar aparelho” e “Tocar som”.',
  stop_lost_mode: 'O Intune não tem modo perdido no Android.',
  clear_app_data: 'O Intune não oferece “limpar dados de app” no Android.',
};

export function toGraphAction(type: CommandType): { action: DeviceAction; body?: Record<string, unknown> } {
  const note = NOT_IN_INTUNE[type];
  if (note) throw new UnsupportedCapabilityError(COMMAND_CAPABILITY[type], { status: 'unsupported', note });
  switch (type) {
    case 'lock':
      return { action: 'remoteLock' };
    case 'reboot':
      return { action: 'rebootNow' };
    case 'locate_device':
      return { action: 'locateDevice' };
    case 'play_lost_sound':
      // `durationInMinutes` (texto) é opcional na referência; sem ele vale o padrão do Intune — conferir no laboratório.
      return { action: 'playLostModeSound' };
    case 'wipe':
      // Redefinição de fábrica completa; o plano de dados do eSIM é preservado (padrão do portal do Intune).
      return {
        action: 'wipe',
        body: { keepEnrollmentData: false, keepUserData: false, persistEsimDataPlan: true },
      };
    default:
      throw new UnsupportedCapabilityError(COMMAND_CAPABILITY[type], { status: 'unsupported' });
  }
}

export interface DeviceActionResult {
  actionName?: string;
  actionState?: string;
  startDateTime?: string;
  lastUpdatedDateTime?: string;
}

/**
 * Lê `deviceActionResults` e diz o que mudou para o comando enviado em `sentAt`. Só conta o resultado da mesma
 * ação iniciado depois do envio (um `done` antigo não confirma um comando novo). Os nomes de `actionName` são
 * comparados sem diferenciar maiúsculas — conferir os valores reais em laboratório.
 */
export function actionProgress(
  action: DeviceAction,
  sentAt: Date,
  results: DeviceActionResult[] | undefined,
): { state: Extract<CommandState, 'device_acknowledged' | 'failed'>; at: Date; detail: string } | null {
  const mine = (results ?? [])
    .filter(
      (r) =>
        r.actionName?.toLowerCase() === action.toLowerCase() &&
        r.startDateTime != null &&
        new Date(r.startDateTime).getTime() >= sentAt.getTime() - 60_000,
    )
    .sort((a, b) => b.startDateTime!.localeCompare(a.startDateTime!))[0];
  if (!mine) return null;
  const at = new Date(mine.lastUpdatedDateTime ?? mine.startDateTime!);
  switch (mine.actionState) {
    case 'done':
      return {
        state: 'device_acknowledged',
        at,
        detail: 'O Intune relatou a ação como concluída no aparelho.',
      };
    case 'failed':
      return { state: 'failed', at, detail: 'O Intune relatou falha na ação.' };
    case 'notSupported':
      return { state: 'failed', at, detail: 'O Intune informou que o aparelho não suporta esta ação.' };
    case 'canceled':
      return { state: 'failed', at, detail: 'A ação foi cancelada no Intune.' };
    default:
      // pending/active/none: continua aguardando.
      return null;
  }
}

interface LocateActionResult extends DeviceActionResult {
  deviceLocation?: {
    latitude?: number | string;
    longitude?: number | string;
    horizontalAccuracy?: number | string;
    lastCollectedDateTime?: string;
  };
}

/** Localização do “Localizar aparelho” enviado em `sentAt` (só a mesma ação, concluída depois do envio). */
export function locateResult(sentAt: Date, results: LocateActionResult[] | undefined): DeviceLocation | null {
  const r = (results ?? [])
    .filter(
      (x) =>
        x.actionName?.toLowerCase() === 'locatedevice' &&
        x.actionState === 'done' &&
        x.startDateTime != null &&
        new Date(x.startDateTime).getTime() >= sentAt.getTime() - 60_000,
    )
    .sort((a, b) => b.startDateTime!.localeCompare(a.startDateTime!))[0];
  const loc = r?.deviceLocation;
  const lat = Number(loc?.latitude);
  const lng = Number(loc?.longitude);
  if (!loc || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }
  const acc = Number(loc.horizontalAccuracy);
  return {
    latitude: lat,
    longitude: lng,
    accuracyMeters: Number.isFinite(acc) && acc >= 0 ? Math.round(acc) : null,
    observedAt: new Date(loc.lastCollectedDateTime ?? r!.lastUpdatedDateTime ?? r!.startDateTime!),
  };
}
