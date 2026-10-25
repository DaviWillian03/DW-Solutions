import { createHash, randomBytes } from 'node:crypto';
import {
  LOCATION_PROVIDER_RETENTION_HOURS,
  TransientProviderError,
  type CapabilityMatrix,
  type DeviceLocation,
  type DeviceManagementProvider,
  type EnrollmentRequest,
  type EnrollmentToken,
  type IssueCommandRequest,
  type LocateResultRequest,
} from '@dw/contracts';

export const DEMO_WARNING = 'DEMONSTRAÇÃO — NÃO PROVISIONA DISPOSITIVO';

const CHECK = 'Classificação esperada no Android real; confirmar na documentação vigente no CHECKPOINT 6.';

/**
 * Provedor de SIMULAÇÃO. Executa tudo sobre dados sintéticos; a matriz informa como cada capacidade
 * se comporta no Android Enterprise real, para que a interface não crie falsa sensação de controle.
 */
export class SimulatorProvider implements DeviceManagementProvider {
  readonly kind = 'simulator' as const;

  /** `failureRate`: chance de erro temporário ao enviar comando (testa retentativas). */
  constructor(
    private readonly opts: { failureRate?: number; random?: () => number; now?: () => Date } = {},
  ) {}

  getCapabilities(): CapabilityMatrix {
    return {
      'enrollment.qr': {
        status: 'requires_eligibility',
        note: `QR real só com Android Management API autorizada. ${CHECK}`,
      },
      'device.inventory': { status: 'requires_eligibility', note: CHECK },
      'telemetry.battery': {
        status: 'requires_eligibility',
        note: `Por relatórios periódicos, não em tempo real. ${CHECK}`,
      },
      'telemetry.storage': { status: 'requires_eligibility', note: `Por relatórios periódicos. ${CHECK}` },
      'telemetry.network': {
        status: 'to_research',
        note: 'Tipo de conexão atual pode exigir app corporativo cooperante.',
      },
      'policy.apply': { status: 'requires_eligibility', note: CHECK },
      'command.lock': { status: 'requires_eligibility', note: CHECK },
      'command.reboot': {
        status: 'requires_eligibility',
        note: `Aparelhos totalmente gerenciados. ${CHECK}`,
      },
      'command.lost_mode': {
        status: 'unsupported',
        note: 'Substituído por “Localizar aparelho” e “Tocar som”: o Intune não tem modo perdido no Android (I-1).',
      },
      'command.clear_app_data': { status: 'requires_eligibility', note: CHECK },
      'command.wipe': {
        status: 'requires_eligibility',
        note: `Irreversível; desligado por padrão. ${CHECK}`,
      },
      'command.locate': {
        status: 'requires_eligibility',
        note: 'Sob demanda, só aparelhos totalmente gerenciados; o responsável é avisado no aparelho (Intune).',
      },
      'command.play_sound': {
        status: 'requires_eligibility',
        note: 'Toca um som no aparelho para achá-lo por perto (Intune, Graph /beta).',
      },
      'location.continuous': {
        status: 'unsupported',
        note: 'Rastreamento contínuo de funcionários não é oferecido.',
      },
    };
  }

  async createEnrollmentToken(req: EnrollmentRequest): Promise<EnrollmentToken> {
    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + req.durationMinutes * 60_000);
    // Conteúdo propositalmente fora do formato do Android: não serve para provisionar nada.
    const qrPayload = JSON.stringify({
      aviso: DEMO_WARNING,
      produto: 'DW Solutions',
      simulador: true,
      token,
    });
    return { token, qrPayload, providerRef: null, expiresAt, demo: true };
  }

  async issueCommand(req: IssueCommandRequest): Promise<{ providerRef: string }> {
    const rate = this.opts.failureRate ?? 0.03;
    if ((this.opts.random ?? Math.random)() < rate) {
      throw new TransientProviderError('Provedor simulado indisponível no momento.');
    }
    // Aceite do PROVEDOR (simulado). A aplicação no aparelho só é confirmada pelo relatório dele.
    return { providerRef: `simulador/operacoes/${req.commandId.slice(0, 8)}` };
  }

  /**
   * Localização SINTÉTICA (região de São Paulo), estável por aparelho. Como o Intune, o “provedor” só a
   * entrega por 24 h depois que o aparelho relatou.
   */
  async getLocateResult(req: LocateResultRequest): Promise<DeviceLocation | null> {
    if (!req.appliedAt) return null;
    const age = (this.opts.now ?? (() => new Date()))().getTime() - req.appliedAt.getTime();
    if (age > LOCATION_PROVIDER_RETENTION_HOURS * 3_600_000) return null;
    const h = createHash('sha256').update(req.deviceId).digest();
    const unit = (i: number) => h.readUInt16BE(i) / 0xffff;
    return {
      latitude: Number((-23.55 + (unit(0) - 0.5) * 0.3).toFixed(5)),
      longitude: Number((-46.63 + (unit(2) - 0.5) * 0.4).toFixed(5)),
      accuracyMeters: 15 + Math.round(unit(4) * 45),
      observedAt: req.appliedAt,
    };
  }
}
