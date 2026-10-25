// Política do DW Solutions → perfil de configuração do Intune (androidDeviceOwnerGeneralDeviceConfiguration,
// Graph /beta). Campos conferidos na referência em 2026-10-25. Nada é enviado enquanto o conector estiver desligado.
import type { PolicySettings } from '@dw/contracts';

/**
 * Campos que NUNCA vão ao Intune:
 * - senha (I-9 / CP6-7: só monitorada até prova em laboratório de que não há bloqueio automático);
 * - “apagar após N senhas erradas” (apagamento automático);
 * - bloqueio de redefinição de fábrica (I-8: em Samsung impede o APAGAR remoto de terminar).
 * Só o tempo de tela (`passwordMinutesOfInactivityBeforeScreenTimeout`) é permitido entre os `password*`.
 */
const ALLOWED_PASSWORD_KEYS = new Set(['passwordMinutesOfInactivityBeforeScreenTimeout']);
const FORBIDDEN_KEYS = new Set(['factoryResetBlocked', 'factoryResetDeviceAdministratorEmails']);

export class UnsafeIntuneConfigError extends Error {
  constructor(readonly keys: string[]) {
    super(
      `Perfil recusado: ${keys.join(', ')} pode bloquear/apagar aparelhos ou impedir o apagar remoto (I-8, I-9).`,
    );
    this.name = 'UnsafeIntuneConfigError';
  }
}

export function assertSafeConfiguration(config: Record<string, unknown>) {
  const bad = Object.keys(config).filter(
    (k) =>
      FORBIDDEN_KEYS.has(k) ||
      /SignInFailureCountBeforeFactoryReset$/.test(k) ||
      /^workProfilePassword/.test(k) ||
      (/^password/.test(k) && !ALLOWED_PASSWORD_KEYS.has(k)),
  );
  if (bad.length) throw new UnsafeIntuneConfigError(bad);
}

export interface IntuneConfiguration {
  '@odata.type': '#microsoft.graph.androidDeviceOwnerGeneralDeviceConfiguration';
  displayName: string;
  description: string;
  appsAllowInstallFromUnknownSources: boolean;
  securityDeveloperSettingsEnabled: boolean;
  passwordMinutesOfInactivityBeforeScreenTimeout: number;
  systemUpdateInstallType: 'automatic' | 'postpone' | 'windowed';
  systemUpdateWindowStartMinutesAfterMidnight?: number;
  systemUpdateWindowEndMinutesAfterMidnight?: number;
  /** I-6: sem coleta automática da última localização de aparelhos dedicados. */
  locateDeviceUserlessDisabled: true;
  /** I-1/I-5: “Localizar aparelho” sob demanda nos totalmente gerenciados (precisa estar ligado no perfil). */
  locateDeviceLostModeEnabled: true;
}

export function toIntuneConfiguration(
  s: PolicySettings,
  meta: { policyName: string; version: number },
): IntuneConfiguration {
  const u = s.systemUpdates;
  const config: IntuneConfiguration = {
    '@odata.type': '#microsoft.graph.androidDeviceOwnerGeneralDeviceConfiguration',
    displayName: `DW Solutions — ${meta.policyName}`,
    description: `Gerado pelo DW Solutions (versão ${meta.version}). Altere pelo DW Solutions, não pelo portal.`,
    appsAllowInstallFromUnknownSources: !s.restrictions.blockUnknownSources,
    securityDeveloperSettingsEnabled: !s.restrictions.blockUsbDebugging,
    passwordMinutesOfInactivityBeforeScreenTimeout: s.screenLock.autoLockMinutes,
    systemUpdateInstallType: u.mode,
    ...(u.mode === 'windowed'
      ? {
          systemUpdateWindowStartMinutesAfterMidnight: u.startMinute,
          systemUpdateWindowEndMinutesAfterMidnight: u.endMinute,
        }
      : {}),
    locateDeviceUserlessDisabled: true,
    locateDeviceLostModeEnabled: true,
  };
  assertSafeConfiguration(config as unknown as Record<string, unknown>);
  return config;
}

/** O que muda entre o modelo do DW Solutions e o que realmente vai ao Intune (mostrado na tela da política). */
export const NOT_SENT_TO_INTUNE = [
  'Tipo e tamanho mínimo da senha: só monitorados (I-9).',
  'Bloquear redefinição de fábrica: não enviado — em Samsung impediria o apagar remoto (I-8).',
  'Versão mínima do Android e idade da atualização de segurança: avaliadas pelo DW Solutions.',
  'Apps obrigatórios: atribuídos à parte, só os já aprovados no Google Play gerenciado da empresa.',
] as const;

// ---------------------------------------------------------------------------
// Políticas de conformidade do tenant: o DW Solutions não cria nenhuma, mas denuncia ações automáticas.
// ---------------------------------------------------------------------------

/** Ações que mexem no aparelho ou no acesso sem um admin decidir (enumeração deviceComplianceActionType). */
const AUTOMATIC = new Set(['block', 'retire', 'wipe', 'remoteLock']);

export interface AutomaticActionFinding {
  policyId: string;
  policyName: string;
  action: string;
  afterHours: number;
}

export function findAutomaticActions(policies: Record<string, unknown>[]): AutomaticActionFinding[] {
  const found: AutomaticActionFinding[] = [];
  for (const p of policies) {
    const rules = (p.scheduledActionsForRule ?? []) as {
      scheduledActionConfigurations?: { actionType?: string; gracePeriodHours?: number }[];
    }[];
    for (const r of rules) {
      for (const a of r.scheduledActionConfigurations ?? []) {
        if (a.actionType && AUTOMATIC.has(a.actionType)) {
          found.push({
            policyId: String(p.id),
            policyName: String(p.displayName ?? p.id),
            action: a.actionType,
            afterHours: a.gracePeriodHours ?? 0,
          });
        }
      }
    }
  }
  return found;
}
