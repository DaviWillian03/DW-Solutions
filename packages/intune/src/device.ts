// managedDevice do Intune (Graph v1.0) → dados do DW Solutions, sempre com origem e horário.
// O Intune não relata bateria, tipo de rede nem se a tela tem senha: esses ficam “desconhecido” (nunca “sem sinal”).

/** Subconjunto do managedDevice usado aqui (nomes conferidos na referência v1.0 em 2026-10-25). */
export interface IntuneManagedDevice {
  id: string;
  deviceName?: string;
  managedDeviceOwnerType?: 'unknown' | 'company' | 'personal';
  operatingSystem?: string;
  osVersion?: string;
  androidSecurityPatchLevel?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  enrolledDateTime?: string;
  lastSyncDateTime?: string;
  complianceState?: string;
  azureADDeviceId?: string;
  enrollmentProfileName?: string;
  totalStorageSpaceInBytes?: number;
  freeStorageSpaceInBytes?: number;
}

/** Conformidade segundo o PRÓPRIO Intune — mostrada à parte; a avaliação do DW Solutions é outra (ADR-0007). */
export const INTUNE_COMPLIANCE_LABEL: Record<string, string> = {
  unknown: 'Desconhecido no Intune',
  compliant: 'Conforme no Intune',
  noncompliant: 'Não conforme no Intune',
  conflict: 'Conflito no Intune',
  error: 'Erro no Intune',
  inGracePeriod: 'Em período de carência no Intune',
  configManager: 'Gerenciado pelo Configuration Manager',
};

export interface NormalizedIntuneDevice {
  providerRef: string;
  entraDeviceId: string | null;
  name: string | null;
  manufacturer: 'samsung' | 'motorola' | null;
  model: string | null;
  androidVersion: number | null;
  securityPatch: string | null;
  serialNumber: string | null;
  enrolledAt: Date | null;
  lastSeenAt: Date | null;
  companyOwned: boolean;
  storage: { totalBytes: number; freeBytes: number; observedAt: string } | null;
  intuneCompliance: string;
  /** O que esta origem não informa — a tela mostra “desconhecido (o Intune não informa)”. */
  notReported: readonly string[];
  /** Divergências que impedem o uso (ex.: não é Android, é pessoal) — aparecem, não somem. */
  problems: string[];
}

export const NOT_REPORTED_BY_INTUNE = ['bateria', 'tipo de rede', 'senha de tela'] as const;

const SUPPORTED = new Set(['samsung', 'motorola']);
const PATCH = /^\d{4}-\d{2}-\d{2}$/;

export function fromManagedDevice(d: IntuneManagedDevice): NormalizedIntuneDevice {
  const maker = (d.manufacturer ?? '').trim().toLowerCase();
  const android = Number.parseInt(d.osVersion ?? '', 10);
  const problems: string[] = [];
  if (d.operatingSystem && d.operatingSystem.toLowerCase() !== 'android') {
    problems.push(`Sistema ${d.operatingSystem} fora do escopo (só Android).`);
  }
  if (d.managedDeviceOwnerType !== 'company') {
    problems.push('Aparelho não marcado como da empresa no Intune.');
  }
  const patch = d.androidSecurityPatchLevel?.trim() ?? '';
  const total = d.totalStorageSpaceInBytes ?? 0;
  return {
    providerRef: d.id,
    entraDeviceId: d.azureADDeviceId ?? null,
    name: d.deviceName ?? null,
    manufacturer: SUPPORTED.has(maker) ? (maker as 'samsung' | 'motorola') : null,
    model: d.model ?? null,
    androidVersion: Number.isFinite(android) ? android : null,
    securityPatch: PATCH.test(patch) ? patch : null,
    serialNumber: d.serialNumber || null,
    enrolledAt: d.enrolledDateTime ? new Date(d.enrolledDateTime) : null,
    lastSeenAt: d.lastSyncDateTime ? new Date(d.lastSyncDateTime) : null,
    companyOwned: d.managedDeviceOwnerType === 'company',
    // O Intune devolve 0 quando não sabe: total 0 = desconhecido, não “sem espaço”.
    storage:
      total > 0 && d.lastSyncDateTime
        ? { totalBytes: total, freeBytes: d.freeStorageSpaceInBytes ?? 0, observedAt: d.lastSyncDateTime }
        : null,
    intuneCompliance: d.complianceState ?? 'unknown',
    notReported: NOT_REPORTED_BY_INTUNE,
    problems,
  };
}
