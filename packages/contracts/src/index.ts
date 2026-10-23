// Contrato entre o produto e quem realmente gerencia os aparelhos (ADR-0001, prompt-mestre §11).
// Hoje só existe o SimulatorProvider; o AndroidManagementProvider entra no CHECKPOINT 6, se elegível.

export type ProviderKind = 'simulator' | 'android_management_api';

/** Classificação obrigatória de cada capacidade (prompt-mestre §17). */
export type CapabilityStatus =
  | 'available'
  | 'requires_eligibility'
  | 'oem_dependent'
  | 'requires_companion_app'
  | 'lab_only'
  | 'unsupported'
  | 'to_research';

export const CAPABILITY_STATUS_LABEL: Record<CapabilityStatus, string> = {
  available: 'Disponível oficialmente',
  requires_eligibility: 'Depende de elegibilidade/credenciais',
  oem_dependent: 'Depende do fabricante/versão',
  requires_companion_app: 'Somente com app corporativo cooperante',
  lab_only: 'Somente em laboratório',
  unsupported: 'Não suportada',
  to_research: 'A pesquisar',
};

export type Capability =
  | 'enrollment.qr'
  | 'device.inventory'
  | 'telemetry.battery'
  | 'telemetry.storage'
  | 'telemetry.network'
  | 'policy.apply'
  | 'command.lock'
  | 'command.reboot'
  | 'command.lost_mode'
  | 'command.clear_app_data'
  | 'command.wipe'
  | 'location.continuous';

export interface CapabilityInfo {
  status: CapabilityStatus;
  /** Explicação verificável exibida ao usuário quando não estiver disponível. */
  note?: string;
}

export type CapabilityMatrix = Record<Capability, CapabilityInfo>;

export class UnsupportedCapabilityError extends Error {
  constructor(
    readonly capability: Capability,
    readonly info: CapabilityInfo,
  ) {
    super(`Capacidade indisponível: ${capability} (${CAPABILITY_STATUS_LABEL[info.status]})`);
    this.name = 'UnsupportedCapabilityError';
  }
}

export interface EnrollmentRequest {
  tenantId: string;
  managementMode: 'fully_managed' | 'dedicated';
  holderId?: string | null;
  displayNameHint?: string | null;
  durationMinutes: number;
}

export interface EnrollmentToken {
  /** Valor secreto mostrado uma única vez (no simulador, só funciona no simulador). */
  token: string;
  /** Conteúdo do QR code. Em modo demonstração, marcado explicitamente como tal. */
  qrPayload: string;
  /** Recurso no provedor (null no simulador). */
  providerRef: string | null;
  expiresAt: Date;
  demo: boolean;
}

/**
 * Provedor de gerenciamento. Implementações devolvem `UnsupportedCapabilityError` em vez de
 * sucesso inventado, e nunca tratam o aceite da API como ação aplicada no aparelho.
 */
export interface DeviceManagementProvider {
  readonly kind: ProviderKind;
  getCapabilities(): CapabilityMatrix;
  createEnrollmentToken(req: EnrollmentRequest): Promise<EnrollmentToken>;
}
