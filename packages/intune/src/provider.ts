// Provedor REAL (Microsoft Intune via Microsoft Graph) — “pronto para ligar”, DESLIGADO por padrão (ADR-0010).
// Só pode ser ligado com licença confirmada (I-3), aplicativo do Entra criado pela TI (I-4) e teste em
// laboratório; até lá toda chamada é recusada antes de qualquer acesso à rede.
import {
  type CapabilityMatrix,
  type DeviceManagementProvider,
  type EnrollmentRequest,
  type EnrollmentToken,
  type IssueCommandRequest,
} from '@dw/contracts';
import type { GraphClient } from './client.js';
import { toGraphAction } from './commands.js';

export class IntuneDisabledError extends Error {
  constructor() {
    super(
      'Conector Microsoft Intune desligado: falta confirmar a licença, criar o aplicativo no Entra e testar em laboratório (ADR-0010).',
    );
    this.name = 'IntuneDisabledError';
  }
}

export interface IntuneConfig {
  client: GraphClient;
  /** Perfis de cadastro (androidDeviceOwnerEnrollmentProfile) criados pela TI, um por modo. */
  enrollmentProfiles: { fully_managed: string; dedicated: string };
  /** Só `true` com as condições do ADR-0010 cumpridas e decisão do usuário registrada. */
  enabled: boolean;
}

const DOCS =
  'Documentação oficial conferida em 2026-10-25; validar em aparelho de laboratório antes de usar.';

export class IntuneProvider implements DeviceManagementProvider {
  readonly kind = 'microsoft_intune' as const;

  constructor(private readonly cfg: IntuneConfig) {}

  private assertEnabled() {
    if (!this.cfg.enabled) throw new IntuneDisabledError();
  }

  getCapabilities(): CapabilityMatrix {
    return {
      'enrollment.qr': {
        status: 'requires_eligibility',
        note: `Perfil de cadastro do Intune (Graph /beta). ${DOCS}`,
      },
      'device.inventory': { status: 'requires_eligibility', note: `Licença do Intune no tenant. ${DOCS}` },
      'telemetry.battery': { status: 'unsupported', note: 'O Intune não informa a bateria.' },
      'telemetry.storage': {
        status: 'requires_eligibility',
        note: 'Espaço total/livre na última sincronização.',
      },
      'telemetry.network': { status: 'unsupported', note: 'O Intune não informa o tipo de conexão.' },
      'policy.apply': {
        status: 'requires_eligibility',
        note: 'Senha e bloqueio de redefinição não são enviados (I-8, I-9). Perfil no Graph /beta.',
      },
      'command.lock': {
        status: 'requires_eligibility',
        note: `Só protege se o aparelho já tiver senha. ${DOCS}`,
      },
      'command.reboot': {
        status: 'requires_eligibility',
        note: `Totalmente gerenciado e dedicado; começa em até ~5 min. ${DOCS}`,
      },
      'command.lost_mode': {
        status: 'unsupported',
        note: 'O Intune não tem modo perdido no Android. Use “Localizar aparelho” e “Tocar som”.',
      },
      'command.clear_app_data': {
        status: 'unsupported',
        note: 'O Intune não oferece “limpar dados de app” no Android.',
      },
      'command.wipe': {
        status: 'requires_eligibility',
        note: `Limite de 500 por dia no tenant. ${DOCS}`,
      },
      'location.continuous': {
        status: 'unsupported',
        note: 'Rastreamento contínuo de funcionários não é oferecido.',
      },
    };
  }

  async createEnrollmentToken(req: EnrollmentRequest): Promise<EnrollmentToken> {
    this.assertEnabled();
    const p = await this.cfg.client.createEnrollmentToken(
      this.cfg.enrollmentProfiles[req.managementMode],
      req.durationMinutes * 60,
    );
    if (!p.tokenValue || !p.qrCodeContent || !p.tokenExpirationDateTime) {
      throw new Error('O Intune não devolveu o token de cadastro.');
    }
    return {
      token: p.tokenValue,
      qrPayload: p.qrCodeContent,
      providerRef: p.id,
      expiresAt: new Date(p.tokenExpirationDateTime),
      demo: false,
    };
  }

  async issueCommand(req: IssueCommandRequest): Promise<{ providerRef: string }> {
    this.assertEnabled();
    if (!req.deviceProviderRef) throw new Error('Aparelho sem referência no provedor.');
    const { action, body } = toGraphAction(req.type);
    await this.cfg.client.deviceAction(req.deviceProviderRef, action, body);
    // 204 = o Intune ACEITOU. Sem número de operação: o acompanhamento é por ação + horário do envio.
    return { providerRef: `${req.deviceProviderRef}/${action}` };
  }
}
