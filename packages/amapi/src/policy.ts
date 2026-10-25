// Política do DW Solutions → recurso Policy da Android Management API.
// Campos conferidos na referência oficial em 2026-10-25 (docs/android/CHECKPOINT_6.md). Nada aqui é enviado ao
// Google enquanto não houver cota aprovada e decisão comercial (CP6-4).
import type { PolicySettings } from '@dw/contracts';

/**
 * Configurações que o Android Device Policy faz cumprir POR PADRÃO bloqueando o aparelho na hora e
 * redefinindo-o após 10 dias (developers.google.com/android/management/compliance). CP6-7/CP6-8: o DW Solutions
 * nunca as envia — senha e versão mínima são só monitoradas.
 */
export const AUTO_ENFORCED_KEYS = [
  'passwordPolicies',
  'passwordRequirements',
  'encryptionPolicy',
  'keyguardDisabled',
  'permittedInputMethods',
  'permittedAccessibilityServices',
  'minimumApiLevel',
  'policyEnforcementRules',
] as const;

export class UnsafePolicyError extends Error {
  constructor(readonly keys: string[]) {
    super(`Política recusada: ${keys.join(', ')} pode bloquear/apagar aparelhos automaticamente (CP6-7/8).`);
    this.name = 'UnsafePolicyError';
  }
}

/** Trava final antes de qualquer envio: nenhuma chave com bloqueio/apagamento automático. */
export function assertNoAutoEnforcement(policy: Record<string, unknown>) {
  const found = AUTO_ENFORCED_KEYS.filter((k) => k in policy);
  if (found.length) throw new UnsafePolicyError(found);
}

/** Versão do Android → nível de API (usado só para avaliar conformidade no DW Solutions). */
export const API_LEVEL: Record<number, number> = { 12: 31, 13: 33, 14: 34, 15: 35, 16: 36 };

export interface AmapiPolicy {
  applications: { packageName: string; installType: 'FORCE_INSTALLED' }[];
  advancedSecurityOverrides: {
    untrustedAppsPolicy: 'DISALLOW_INSTALL' | 'ALLOW_INSTALL_DEVICE_WIDE';
    developerSettings: 'DEVELOPER_SETTINGS_DISABLED' | 'DEVELOPER_SETTINGS_ALLOWED';
  };
  factoryResetDisabled: boolean;
  /** Milissegundos, como string (int64). */
  maximumTimeToLock: string;
  systemUpdate:
    | { type: 'AUTOMATIC' }
    | { type: 'POSTPONE' }
    | { type: 'WINDOWED'; startMinutes: number; endMinutes: number };
  /** O que o aparelho relata — base da conformidade avaliada pelo DW Solutions. */
  statusReportingSettings: {
    deviceSettingsEnabled: true;
    softwareInfoEnabled: true;
    hardwareStatusEnabled: true;
    memoryInfoEnabled: true;
    networkInfoEnabled: true;
    powerManagementEventsEnabled: true;
    applicationReportsEnabled: true;
  };
}

/**
 * Converte as configurações. Fica de FORA de propósito:
 * - tipo e tamanho da senha → monitorados por `deviceSettings.isDeviceSecure` (CP6-7);
 * - Android mínimo e idade do patch → avaliados pelo DW Solutions com o inventário relatado (CP6-8).
 */
export function toAmapiPolicy(s: PolicySettings): AmapiPolicy {
  const u = s.systemUpdates;
  const policy: AmapiPolicy = {
    applications: s.requiredApps.map((a) => ({ packageName: a.packageName, installType: 'FORCE_INSTALLED' })),
    advancedSecurityOverrides: {
      untrustedAppsPolicy: s.restrictions.blockUnknownSources
        ? 'DISALLOW_INSTALL'
        : 'ALLOW_INSTALL_DEVICE_WIDE',
      developerSettings: s.restrictions.blockUsbDebugging
        ? 'DEVELOPER_SETTINGS_DISABLED'
        : 'DEVELOPER_SETTINGS_ALLOWED',
    },
    factoryResetDisabled: s.restrictions.blockFactoryReset,
    maximumTimeToLock: String(s.screenLock.autoLockMinutes * 60_000),
    systemUpdate:
      u.mode === 'windowed'
        ? { type: 'WINDOWED', startMinutes: u.startMinute, endMinutes: u.endMinute }
        : { type: u.mode === 'automatic' ? 'AUTOMATIC' : 'POSTPONE' },
    statusReportingSettings: {
      deviceSettingsEnabled: true,
      softwareInfoEnabled: true,
      hardwareStatusEnabled: true,
      memoryInfoEnabled: true,
      networkInfoEnabled: true,
      powerManagementEventsEnabled: true,
      applicationReportsEnabled: true,
    },
  };
  assertNoAutoEnforcement(policy as unknown as Record<string, unknown>);
  return policy;
}

/** O que muda entre o modelo do DW Solutions e o que realmente vai ao aparelho (mostrado na tela no CP6+). */
export const NOT_SENT_TO_DEVICE = [
  'Tipo e tamanho mínimo da senha: só monitorados (o aparelho relata se tem senha).',
  'Versão mínima do Android e idade da atualização de segurança: avaliadas pelo DW Solutions.',
] as const;
