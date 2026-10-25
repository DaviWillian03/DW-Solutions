import type { CommandType, DeviceLocation } from './commands.js';

// Contrato entre o produto e quem realmente gerencia os aparelhos (ADR-0001, prompt-mestre §11).
// Hoje só o SimulatorProvider está ligado; @dw/amapi e @dw/intune existem desligados (ADR-0009, ADR-0010).

export type ProviderKind = 'simulator' | 'android_management_api' | 'microsoft_intune';

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
  | 'command.locate'
  | 'command.play_sound'
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
  /**
   * Envia um comando ao provedor. Sucesso = o PROVEDOR aceitou (`provider_accepted`); a aplicação no
   * aparelho só é confirmada depois, pelo relatório do próprio aparelho.
   */
  issueCommand(req: IssueCommandRequest): Promise<{ providerRef: string }>;
  /**
   * Resultado de um “Localizar aparelho” já aplicado, lido NA HORA no provedor (o DW Solutions não grava
   * coordenadas — I-5). `null` = o provedor não tem (ainda não relatou, ou já apagou depois do prazo).
   */
  getLocateResult(req: LocateResultRequest): Promise<DeviceLocation | null>;
}

export interface LocateResultRequest {
  tenantId: string;
  commandId: string;
  deviceId: string;
  deviceProviderRef: string | null;
  /** Quando o comando foi enviado: resultados anteriores não contam. */
  sentAt: Date;
  /** Quando o DW Solutions registrou a aplicação verificada (null = ainda não). */
  appliedAt: Date | null;
}

export interface IssueCommandRequest {
  tenantId: string;
  commandId: string;
  deviceProviderRef: string | null;
  type: CommandType;
  params: Record<string, unknown>;
}

/** Erro temporário do provedor: o envio pode ser tentado de novo. */
export class TransientProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransientProviderError';
  }
}

export const COMMAND_CAPABILITY: Record<CommandType, Capability> = {
  lock: 'command.lock',
  reboot: 'command.reboot',
  start_lost_mode: 'command.lost_mode',
  stop_lost_mode: 'command.lost_mode',
  clear_app_data: 'command.clear_app_data',
  wipe: 'command.wipe',
  locate_device: 'command.locate',
  play_lost_sound: 'command.play_sound',
};

// ---------------------------------------------------------------------------
// Filas (BullMQ). A API só publica; o worker processa (ADR-0002).
// ---------------------------------------------------------------------------
export const SIMULATOR_QUEUE = 'dw-simulador';
/** Prefixo no Redis: testes nunca compartilham fila com o ambiente de desenvolvimento. */
export const queuePrefix = (nodeEnv: string) => (nodeEnv === 'test' ? 'dw-test' : 'dw');

export interface SimulatorEnrollJob {
  tenantId: string;
  tokenId: string;
}
/** Envio de um comando ao provedor (job `command`). */
export interface CommandJob {
  tenantId: string;
  commandId: string;
}
/** SIMULADOR: o aparelho “liga” e comunica agora (job `checkin`). */
export interface SimulatorCheckInJob {
  tenantId: string;
  deviceId: string;
}
/** Tentativas de envio ao provedor antes de o comando ser dado como falho. */
export const COMMAND_SEND_ATTEMPTS = 3;

/** Leitura de dados sincronizados: sempre com origem e horário (prompt-mestre §11). */
export type Connectivity = 'online' | 'silent' | 'unknown';
export const SILENT_AFTER_HOURS = 24;

export * from './policy.js';
export * from './commands.js';
export * from './audit.js';
