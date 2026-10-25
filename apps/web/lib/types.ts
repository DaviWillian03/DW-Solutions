import type {
  CommandState,
  CommandType,
  ComplianceReason,
  ComplianceStatus,
  PolicyChange,
  PolicySettings,
} from '@dw/contracts';
import type { Connectivity } from '@/components/status';

export interface ObservedValue<T> {
  value: T;
  observedAt: string;
}

export interface DeviceItem {
  id: string;
  displayName: string;
  manufacturer: string;
  model: string;
  androidVersion: number;
  securityPatch: string | null;
  managementMode: string;
  enrollmentState: string;
  holder: { id: string; name: string | null } | null;
  connectivity: Connectivity;
  lastSeenAt: string | null;
  battery: ObservedValue<number> | null;
  storageFree: ObservedValue<number> | null;
  network: ObservedValue<string> | null;
  source: string;
  policy: {
    id: string;
    name: string | null;
    version: number;
    appliedVersion: number | null;
    assignedAt: string | null;
    reportedAt: string | null;
  } | null;
  compliance: { status: ComplianceStatus; reasons: ComplianceReason[]; evaluatedAt: string | null };
  lostModeSince: string | null;
}

export interface DeviceDetail extends DeviceItem {
  serialNumber: string | null;
  providerRef: string | null;
  enrolledAt: string | null;
  capabilities: Record<string, { status: string; note?: string }>;
}

export interface DeviceList {
  items: DeviceItem[];
  total: number;
  page: number;
  pageSize: number;
  generatedAt: string;
  source: string;
}

export interface Summary {
  counts: {
    total: number;
    online: number;
    silent: number;
    unknown: number;
    unassigned: number;
    lowBattery: number;
    pendingEnrollments: number;
    noncompliant: number;
    complianceUnknown: number;
    noPolicy: number;
    policyPending: number;
    commandsPending: number;
    approvalsPending: number;
  };
  noncompliant: DeviceItem[];
  byManufacturer: { key: string; n: number }[];
  byAndroid: { key: number; n: number }[];
  attention: DeviceItem[];
  generatedAt: string;
  source: string;
  silentAfterHours: number;
}

export interface Holder {
  id: string;
  fullName: string;
  employeeCode: string | null;
  role: 'sales' | 'merchandising' | 'other';
  status: 'active' | 'inactive';
  devices: number;
}

export interface DeviceEvent {
  id: string;
  occurredAt: string;
  type: string;
  source: string;
  details: Record<string, unknown>;
}

export interface Enrollment {
  id: string;
  status: 'waiting_scan' | 'processing' | 'enrolled' | 'expired';
  demo: boolean;
  managementMode: string;
  holder: { id: string; name: string | null } | null;
  policy: { id: string; name: string | null } | null;
  displayNameHint: string | null;
  expiresAt: string;
  createdAt: string;
  deviceId: string | null;
  deviceName?: string | null;
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'viewer';
  status: 'active' | 'disabled';
  twoFactorEnabled: boolean;
  createdAt: string;
}

export const CAPABILITY_LABEL: Record<string, string> = {
  'enrollment.qr': 'Cadastro por QR code',
  'device.inventory': 'Inventário do aparelho',
  'telemetry.battery': 'Nível de bateria',
  'telemetry.storage': 'Armazenamento livre',
  'telemetry.network': 'Tipo de conexão',
  'policy.apply': 'Aplicar política',
  'command.lock': 'Bloquear tela',
  'command.reboot': 'Reiniciar',
  'command.lost_mode': 'Modo perdido (substituído por Localizar e Tocar som)',
  'command.locate': 'Localizar aparelho (sob demanda)',
  'command.play_sound': 'Tocar som',
  'command.clear_app_data': 'Limpar dados de app',
  'command.wipe': 'Apagar aparelho',
  'location.continuous': 'Localização contínua',
};

export const CAPABILITY_STATUS: Record<string, string> = {
  available: 'Disponível oficialmente',
  requires_eligibility: 'Depende de elegibilidade/credenciais',
  oem_dependent: 'Depende do fabricante/versão',
  requires_companion_app: 'Somente com app corporativo cooperante',
  lab_only: 'Somente em laboratório',
  unsupported: 'Não suportada',
  to_research: 'A pesquisar',
};

export interface PolicyStats {
  devices: number;
  compliant: number;
  noncompliant: number;
  unknown: number;
  pending: number;
}

export interface PolicySummary {
  id: string;
  name: string;
  description: string;
  template: 'sales' | 'merchandising';
  currentVersion: number;
  updatedAt: string;
  updatedByName: string;
  settings: PolicySettings;
  stats: PolicyStats;
}

export interface PolicyDetail extends Omit<PolicySummary, 'updatedAt' | 'updatedByName'> {
  versions: { version: number; note: string; createdByName: string; createdAt: string }[];
}

export interface PolicyPreview {
  baseVersion: number;
  changes: PolicyChange[];
  impact: {
    devices: number;
    silentOrUnknown: number;
    failingByRule: { min_android: number; security_patch: number };
    newlyFailing: number;
    newlyFailingSample: { id: string; displayName: string; reasons: ComplianceReason[] }[];
    resolved: number;
  };
  estimate: true;
  generatedAt: string;
}

export interface CommandEventItem {
  state: CommandState;
  actor: string;
  detail: string | null;
  occurredAt: string;
}

export interface CommandItem {
  id: string;
  deviceId: string;
  deviceName: string | null;
  batchId: string | null;
  type: CommandType;
  params: Record<string, unknown>;
  reason: string | null;
  state: CommandState;
  stateDetail: string | null;
  requestedBy: string;
  requestedByName: string;
  providerRef: string | null;
  sendAttempts: number;
  expiresAt: string;
  finishedAt: string | null;
  createdAt: string;
  cancellable: boolean;
  source: string;
  events: CommandEventItem[];
}

export interface CommandList {
  items: CommandItem[];
  total: number;
  page: number;
  pageSize: number;
  generatedAt: string;
  source: string;
}

export interface BatchItem {
  id: string;
  type: CommandType;
  reason: string | null;
  status: 'not_required' | 'waiting_approval' | 'approved' | 'rejected' | 'expired';
  deviceCount: number;
  devices: { id: string; name: string }[];
  requestedByName: string;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  expiresAt: string | null;
  createdAt: string;
  canDecide: boolean;
}

/** Localização lida na hora no provedor (I-5): nunca guardada no DW Solutions. */
export interface CommandLocation {
  commandId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  observedAt: string;
  availableUntil: string | null;
  source: string;
}
