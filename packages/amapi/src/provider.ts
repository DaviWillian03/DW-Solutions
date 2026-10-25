// Provedor REAL (Android Management API) — “pronto para ligar”, DESLIGADO por padrão (CP6-1, CP6-4).
// Só pode ser ligado com cota aprovada pelo Google e enquadramento comercial definido; até lá toda chamada
// é recusada antes de qualquer acesso à rede.
import {
  type CapabilityMatrix,
  type DeviceManagementProvider,
  type EnrollmentRequest,
  type EnrollmentToken,
  type IssueCommandRequest,
} from '@dw/contracts';
import type { AmapiClient } from './client.js';
import { toAmapiCommand } from './commands.js';

export class ProviderDisabledError extends Error {
  constructor() {
    super(
      'Conector Android Management API desligado: sem cota aprovada pelo Google e sem enquadramento comercial (CHECKPOINT 6).',
    );
    this.name = 'ProviderDisabledError';
  }
}

export interface AndroidManagementConfig {
  client: AmapiClient;
  /** enterprises/{id} da empresa cliente (cada empresa do DW Solutions = uma enterprise no Google). */
  enterpriseName: string;
  /** Só `true` com cota aprovada e decisão do usuário registrada. */
  enabled: boolean;
}

const REAL =
  'Documentação oficial conferida em 2026-10-25; validar em aparelho de laboratório antes de usar.';

export class AndroidManagementProvider implements DeviceManagementProvider {
  readonly kind = 'android_management_api' as const;

  constructor(private readonly cfg: AndroidManagementConfig) {}

  private assertEnabled() {
    if (!this.cfg.enabled) throw new ProviderDisabledError();
  }

  getCapabilities(): CapabilityMatrix {
    return {
      'enrollment.qr': { status: 'requires_eligibility', note: `Token de cadastro com QR oficial. ${REAL}` },
      'device.inventory': { status: 'requires_eligibility', note: REAL },
      'telemetry.battery': {
        status: 'requires_eligibility',
        note: `Eventos de energia relatados periodicamente. ${REAL}`,
      },
      'telemetry.storage': {
        status: 'requires_eligibility',
        note: `Relatório de memória periódico. ${REAL}`,
      },
      'telemetry.network': {
        status: 'to_research',
        note: 'Tipo de conexão atual não é relatado diretamente.',
      },
      'policy.apply': {
        status: 'requires_eligibility',
        note: 'Senha e versão mínima só monitoradas (CP6-7/8): não são enviadas para evitar bloqueio/apagamento automático.',
      },
      'command.lock': { status: 'requires_eligibility', note: REAL },
      'command.reboot': {
        status: 'requires_eligibility',
        note: `Totalmente gerenciado, Android 7+. ${REAL}`,
      },
      'command.lost_mode': {
        status: 'requires_eligibility',
        note: `Totalmente gerenciado ou da empresa com perfil de trabalho. ${REAL}`,
      },
      'command.clear_app_data': { status: 'requires_eligibility', note: `Android 9+. ${REAL}` },
      'command.wipe': {
        status: 'requires_eligibility',
        note: `Comando WIPE (redefinição de fábrica). ${REAL}`,
      },
      'location.continuous': {
        status: 'unsupported',
        note: 'Rastreamento contínuo de funcionários não é oferecido.',
      },
    };
  }

  async createEnrollmentToken(req: EnrollmentRequest & { policyName?: string }): Promise<EnrollmentToken> {
    this.assertEnabled();
    const t = await this.cfg.client.createEnrollmentToken(this.cfg.enterpriseName, {
      ...(req.policyName ? { policyName: req.policyName } : {}),
      duration: `${req.durationMinutes * 60}s`,
      oneTimeOnly: true,
      // Totalmente gerenciado sem uso pessoal; dedicado exige o valor “sem usuário”.
      allowPersonalUsage:
        req.managementMode === 'dedicated'
          ? 'PERSONAL_USAGE_DISALLOWED_USERLESS'
          : 'PERSONAL_USAGE_DISALLOWED',
      additionalData: JSON.stringify({ tenantId: req.tenantId }),
    });
    return {
      token: t.value,
      qrPayload: t.qrCode,
      providerRef: t.name,
      expiresAt: new Date(t.expirationTimestamp),
      demo: false,
    };
  }

  async issueCommand(req: IssueCommandRequest): Promise<{ providerRef: string }> {
    this.assertEnabled();
    if (!req.deviceProviderRef) throw new Error('Aparelho sem referência no provedor.');
    const op = await this.cfg.client.issueCommand(
      req.deviceProviderRef,
      toAmapiCommand(req.type, req.params),
    );
    // Operação ACEITA pelo Google ≠ aplicada: a confirmação vem do relatório do aparelho.
    return { providerRef: op.name };
  }
}
