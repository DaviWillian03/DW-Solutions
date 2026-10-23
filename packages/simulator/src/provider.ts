import { randomBytes } from 'node:crypto';
import {
  TransientProviderError,
  type CapabilityMatrix,
  type DeviceManagementProvider,
  type EnrollmentRequest,
  type EnrollmentToken,
  type IssueCommandRequest,
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
  constructor(private readonly opts: { failureRate?: number; random?: () => number } = {}) {}

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
        status: 'oem_dependent',
        note: `Aparelhos da empresa em versões recentes do Android. ${CHECK}`,
      },
      'command.clear_app_data': { status: 'requires_eligibility', note: CHECK },
      'command.wipe': {
        status: 'requires_eligibility',
        note: `Irreversível; desligado por padrão. ${CHECK}`,
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
}
