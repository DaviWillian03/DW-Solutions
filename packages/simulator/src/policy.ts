import { evaluateCompliance, type PolicyReport, type PolicySettings } from '@dw/contracts';
import { and, ensureDefaultPolicies, eq, policyVersions, type Device, type Tx } from '@dw/db';

export interface PolicyRef {
  id: string;
  name: string;
  version: number;
  settings: PolicySettings;
}

export interface SimTraits {
  screenLockSet: boolean;
  appInstallIssue: boolean;
}

/**
 * Relatório que o aparelho SIMULADO devolve sobre a política aplicada. Restrições (fontes desconhecidas,
 * depuração USB, redefinição) são impostas pelo gerenciador e sempre aplicadas; o que depende do
 * usuário ou da rede (criar a senha, instalar apps) pode ficar pendente.
 */
export function simulatedReport(settings: PolicySettings, traits: SimTraits): PolicyReport {
  const nonCompliance: PolicyReport['nonCompliance'] = [];
  if (!traits.screenLockSet) nonCompliance.push({ setting: 'screen_lock', reason: 'user_action' });
  const app = settings.requiredApps[0];
  if (traits.appInstallIssue && app) {
    nonCompliance.push({
      setting: 'required_app',
      packageName: app.packageName,
      reason: 'app_not_installed',
    });
  }
  return { nonCompliance };
}

/** Colunas de política/conformidade do aparelho depois de um relatório recebido em `at`. */
export function reportedColumns(
  device: Pick<Device, 'androidVersion' | 'securityPatch'>,
  ref: PolicyRef,
  traits: SimTraits,
  at: Date,
) {
  const report = simulatedReport(ref.settings, traits);
  const r = evaluateCompliance({
    policy: { version: ref.version, settings: ref.settings },
    appliedVersion: ref.version,
    report,
    androidVersion: device.androidVersion,
    securityPatch: device.securityPatch,
    now: at,
  });
  return {
    appliedPolicyVersion: ref.version,
    policyReportedAt: at,
    policyReport: report,
    compliance: r.status,
    complianceReasons: r.reasons,
    complianceEvaluatedAt: at,
  };
}

/** Busca (com cache por ciclo) as configurações de uma versão específica da política. */
export function versionLoader(tx: Tx) {
  const cache = new Map<string, PolicyRef | null>();
  return async (policyId: string, version: number): Promise<PolicyRef | null> => {
    const key = `${policyId}:${version}`;
    if (!cache.has(key)) {
      const [v] = await tx
        .select({ settings: policyVersions.settings })
        .from(policyVersions)
        .where(and(eq(policyVersions.policyId, policyId), eq(policyVersions.version, version)));
      cache.set(key, v ? { id: policyId, name: '', version, settings: v.settings } : null);
    }
    return cache.get(key)!;
  };
}

/** Políticas prontas da empresa (criadas se faltarem) com as configurações da versão atual. */
export async function defaultPolicyRefs(tx: Tx, tenantId: string) {
  const p = await ensureDefaultPolicies(tx, tenantId);
  const load = versionLoader(tx);
  const ref = async (x: (typeof p)['sales']): Promise<PolicyRef> => ({
    ...(await load(x.id, x.currentVersion))!,
    name: x.name,
  });
  return { sales: await ref(p.sales), merchandising: await ref(p.merchandising) };
}
