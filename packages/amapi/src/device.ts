// Recurso Device da AMAPI → dados do DW Solutions, sempre com origem e horário (nada vira “ao vivo”).
import type { PolicyReport } from '@dw/contracts';

/** Subconjunto do Device usado aqui (nomes conferidos na referência oficial em 2026-10-25). */
export interface AmapiDevice {
  name: string;
  state?: string;
  appliedState?: string;
  managementMode?: string;
  ownership?: string;
  policyName?: string;
  appliedPolicyName?: string;
  appliedPolicyVersion?: string;
  policyCompliant?: boolean;
  nonComplianceDetails?: {
    settingName?: string;
    nonComplianceReason?: string;
    packageName?: string;
  }[];
  enrollmentTime?: string;
  lastStatusReportTime?: string;
  lastPolicySyncTime?: string;
  hardwareInfo?: { brand?: string; manufacturer?: string; model?: string; serialNumber?: string };
  softwareInfo?: { androidVersion?: string; securityPatchLevel?: string };
  deviceSettings?: {
    isDeviceSecure?: boolean;
    unknownSourcesEnabled?: boolean;
    developmentSettingsEnabled?: boolean;
    adbEnabled?: boolean;
  };
  powerManagementEvents?: { eventType?: string; createTime?: string; batteryLevel?: number }[];
}

export interface NormalizedDevice {
  providerRef: string;
  manufacturer: 'samsung' | 'motorola' | null;
  model: string | null;
  androidVersion: number | null;
  securityPatch: string | null;
  serialNumber: string | null;
  enrolledAt: Date | null;
  lastSeenAt: Date | null;
  appliedPolicyVersion: number | null;
  managed: boolean;
  lost: boolean;
  battery: { value: number; observedAt: string } | null;
  report: PolicyReport;
  /** Pendências que o DW Solutions ainda não sabe interpretar — aparecem, não somem. */
  unmapped: string[];
}

const SUPPORTED = new Set(['samsung', 'motorola']);

export function fromAmapiDevice(d: AmapiDevice): NormalizedDevice {
  const maker = (d.hardwareInfo?.manufacturer ?? d.hardwareInfo?.brand ?? '').toLowerCase();
  const android = Number.parseInt(d.softwareInfo?.androidVersion ?? '', 10);
  const nonCompliance: PolicyReport['nonCompliance'] = [];
  const unmapped: string[] = [];
  for (const n of d.nonComplianceDetails ?? []) {
    if (n.nonComplianceReason === 'APP_NOT_INSTALLED' && n.packageName) {
      nonCompliance.push({
        setting: 'required_app',
        packageName: n.packageName,
        reason: 'app_not_installed',
      });
    } else {
      unmapped.push(`${n.settingName ?? '?'}: ${n.nonComplianceReason ?? '?'}`);
    }
  }
  // Senha só monitorada (CP6-7): vem do relatório de configurações do aparelho.
  if (d.deviceSettings?.isDeviceSecure === false)
    nonCompliance.push({ setting: 'screen_lock', reason: 'user_action' });
  const battery = (d.powerManagementEvents ?? [])
    .filter((e) => e.eventType === 'BATTERY_LEVEL_COLLECTED' && e.batteryLevel != null && e.createTime)
    .sort((a, b) => b.createTime!.localeCompare(a.createTime!))[0];
  return {
    providerRef: d.name,
    manufacturer: SUPPORTED.has(maker) ? (maker as 'samsung' | 'motorola') : null,
    model: d.hardwareInfo?.model ?? null,
    androidVersion: Number.isFinite(android) ? android : null,
    securityPatch: d.softwareInfo?.securityPatchLevel ?? null,
    serialNumber: d.hardwareInfo?.serialNumber ?? null,
    enrolledAt: d.enrollmentTime ? new Date(d.enrollmentTime) : null,
    lastSeenAt: d.lastStatusReportTime ? new Date(d.lastStatusReportTime) : null,
    appliedPolicyVersion: d.appliedPolicyVersion ? Number(d.appliedPolicyVersion) : null,
    managed: d.state === 'ACTIVE' || d.state === 'LOST',
    lost: d.state === 'LOST' || d.appliedState === 'LOST',
    battery: battery ? { value: Math.round(battery.batteryLevel!), observedAt: battery.createTime! } : null,
    report: { nonCompliance },
    unmapped,
  };
}
