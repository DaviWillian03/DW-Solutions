// Modelo declarativo de política (prompt-mestre §5.5), independente do provedor. Cada campo tem um
// equivalente previsto na Android Management API (a confirmar no CHECKPOINT 6); nada aqui provoca
// bloqueio ou apagamento automático por não conformidade.
import { z } from 'zod';

export const PASSWORD_QUALITY = ['numeric', 'numeric_complex', 'alphanumeric'] as const;
export type PasswordQuality = (typeof PASSWORD_QUALITY)[number];

const packageName = z
  .string()
  .trim()
  .max(150)
  .regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, 'Nome de pacote Android inválido (ex.: com.empresa.app).');

const minuteOfDay = z.number().int().min(0).max(1439);

export const policySettingsSchema = z
  .object({
    screenLock: z
      .object({
        quality: z.enum(PASSWORD_QUALITY),
        minLength: z.number().int().min(4).max(16),
        autoLockMinutes: z.number().int().min(1).max(30),
      })
      .strict(),
    requiredApps: z
      .array(z.object({ packageName, name: z.string().trim().min(2).max(60) }).strict())
      .max(15)
      .refine((apps) => new Set(apps.map((a) => a.packageName)).size === apps.length, {
        message: 'O mesmo app aparece mais de uma vez.',
      }),
    restrictions: z
      .object({
        blockUnknownSources: z.boolean(),
        blockUsbDebugging: z.boolean(),
        blockFactoryReset: z.boolean(),
      })
      .strict(),
    systemUpdates: z.discriminatedUnion('mode', [
      z.object({ mode: z.literal('automatic') }).strict(),
      z
        .object({ mode: z.literal('windowed'), startMinute: minuteOfDay, endMinute: minuteOfDay })
        .strict()
        .refine((w) => w.startMinute !== w.endMinute, { message: 'A janela precisa ter duração.' }),
      z.object({ mode: z.literal('postpone') }).strict(),
    ]),
    compliance: z
      .object({
        minAndroidVersion: z.number().int().min(12).max(16),
        maxSecurityPatchAgeDays: z.number().int().min(30).max(365).nullable(),
      })
      .strict(),
  })
  .strict();

export type PolicySettings = z.infer<typeof policySettingsSchema>;
export type PolicyTemplate = 'sales' | 'merchandising';

const NIGHT = { mode: 'windowed' as const, startMinute: 22 * 60, endMinute: 5 * 60 };

/** Modelos prontos (CP4-1). Os apps são FICTÍCIOS: servem para demonstrar a regra no simulador. */
export const POLICY_TEMPLATES: Record<
  PolicyTemplate,
  { name: string; description: string; settings: PolicySettings }
> = {
  sales: {
    name: 'Vendas',
    description: 'Smartphones de vendedores externos: pedidos, catálogo e rota do dia.',
    settings: {
      screenLock: { quality: 'numeric_complex', minLength: 6, autoLockMinutes: 2 },
      requiredApps: [
        { packageName: 'exemplo.vendas.pedidos', name: 'Pedidos (fictício)' },
        { packageName: 'exemplo.vendas.catalogo', name: 'Catálogo (fictício)' },
      ],
      restrictions: { blockUnknownSources: true, blockUsbDebugging: true, blockFactoryReset: true },
      systemUpdates: NIGHT,
      compliance: { minAndroidVersion: 12, maxSecurityPatchAgeDays: 180 },
    },
  },
  merchandising: {
    name: 'Merchandising',
    description: 'Smartphones de promotores: execução em loja e fotos de gôndola.',
    settings: {
      screenLock: { quality: 'numeric_complex', minLength: 6, autoLockMinutes: 5 },
      requiredApps: [
        { packageName: 'exemplo.merch.execucao', name: 'Execução em loja (fictício)' },
        { packageName: 'exemplo.merch.fotos', name: 'Fotos de gôndola (fictício)' },
      ],
      restrictions: { blockUnknownSources: true, blockUsbDebugging: true, blockFactoryReset: true },
      systemUpdates: NIGHT,
      compliance: { minAndroidVersion: 12, maxSecurityPatchAgeDays: 180 },
    },
  },
};

// ---------------------------------------------------------------------------
// Textos e comparação (usados na API e no site)
// ---------------------------------------------------------------------------
export const PASSWORD_QUALITY_LABEL: Record<PasswordQuality, string> = {
  numeric: 'Só números',
  numeric_complex: 'Números sem sequência (ex.: não 1234)',
  alphanumeric: 'Letras e números',
};

const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function describeUpdates(u: PolicySettings['systemUpdates']): string {
  if (u.mode === 'automatic') return 'Automáticas, assim que disponíveis';
  if (u.mode === 'postpone') return 'Adiadas por até 30 dias';
  return `Na janela das ${hhmm(u.startMinute)} às ${hhmm(u.endMinute)}`;
}

const blocked = (b: boolean) => (b ? 'Bloqueado' : 'Permitido');

interface Field {
  key: string;
  label: string;
  read: (s: PolicySettings) => string;
}

/** Campos comparáveis, na ordem em que aparecem na tela. */
export const POLICY_FIELDS: Field[] = [
  {
    key: 'screenLock.quality',
    label: 'Tipo de senha de tela',
    read: (s) => PASSWORD_QUALITY_LABEL[s.screenLock.quality],
  },
  {
    key: 'screenLock.minLength',
    label: 'Tamanho mínimo da senha',
    read: (s) => `${s.screenLock.minLength} caracteres`,
  },
  {
    key: 'screenLock.autoLockMinutes',
    label: 'Bloqueio automático da tela',
    read: (s) => `Após ${s.screenLock.autoLockMinutes} min sem uso`,
  },
  {
    key: 'restrictions.blockUnknownSources',
    label: 'Instalar apps de fontes desconhecidas',
    read: (s) => blocked(s.restrictions.blockUnknownSources),
  },
  {
    key: 'restrictions.blockUsbDebugging',
    label: 'Depuração USB (opções do desenvolvedor)',
    read: (s) => blocked(s.restrictions.blockUsbDebugging),
  },
  {
    key: 'restrictions.blockFactoryReset',
    label: 'Redefinição de fábrica pelo usuário',
    read: (s) => blocked(s.restrictions.blockFactoryReset),
  },
  { key: 'systemUpdates', label: 'Atualizações do sistema', read: (s) => describeUpdates(s.systemUpdates) },
  {
    key: 'compliance.minAndroidVersion',
    label: 'Versão mínima do Android',
    read: (s) => `Android ${s.compliance.minAndroidVersion}`,
  },
  {
    key: 'compliance.maxSecurityPatchAgeDays',
    label: 'Idade máxima da atualização de segurança',
    read: (s) =>
      s.compliance.maxSecurityPatchAgeDays == null
        ? 'Sem limite'
        : `${s.compliance.maxSecurityPatchAgeDays} dias`,
  },
];

export interface PolicyChange {
  key: string;
  label: string;
  from: string;
  to: string;
}

/** Diferenças legíveis entre duas versões (apps comparados pelo nome do pacote). */
export function diffPolicySettings(a: PolicySettings, b: PolicySettings): PolicyChange[] {
  const changes: PolicyChange[] = [];
  for (const f of POLICY_FIELDS) {
    const from = f.read(a);
    const to = f.read(b);
    if (from !== to) changes.push({ key: f.key, label: f.label, from, to });
  }
  const before = new Map(a.requiredApps.map((x) => [x.packageName, x.name]));
  const after = new Map(b.requiredApps.map((x) => [x.packageName, x.name]));
  for (const [pkg, name] of after) {
    if (!before.has(pkg))
      changes.push({
        key: `requiredApps.${pkg}`,
        label: 'App obrigatório',
        from: '—',
        to: `${name} (${pkg})`,
      });
    else if (before.get(pkg) !== name)
      changes.push({
        key: `requiredApps.${pkg}`,
        label: 'App obrigatório',
        from: before.get(pkg)!,
        to: name,
      });
  }
  for (const [pkg, name] of before) {
    if (!after.has(pkg))
      changes.push({
        key: `requiredApps.${pkg}`,
        label: 'App obrigatório',
        from: `${name} (${pkg})`,
        to: '—',
      });
  }
  return changes;
}

// ---------------------------------------------------------------------------
// Conformidade (prompt-mestre §5.5): sempre com motivo, horário e como corrigir.
// ---------------------------------------------------------------------------
export type ComplianceStatus = 'compliant' | 'noncompliant' | 'unknown' | 'not_applicable';

export const COMPLIANCE_LABEL: Record<ComplianceStatus, string> = {
  compliant: 'Conforme',
  noncompliant: 'Não conforme',
  unknown: 'Desconhecido',
  not_applicable: 'Sem política',
};

export type ComplianceCode =
  'awaiting_device' | 'screen_lock' | 'required_app' | 'min_android' | 'security_patch';

export interface ComplianceReason {
  code: ComplianceCode;
  message: string;
  fix?: string;
}

/** O que o aparelho relatou sobre a política aplicada (no simulador, gerado pelo SimulatorProvider). */
export interface PolicyReport {
  nonCompliance: Array<
    | { setting: 'screen_lock'; reason: 'user_action' }
    | { setting: 'required_app'; packageName: string; reason: 'app_not_installed' }
  >;
}

export interface ComplianceInput {
  /** Política desejada para o aparelho (null = sem política). */
  policy: { version: number; settings: PolicySettings } | null;
  /** Versão que o aparelho relatou ter aplicado (null = ainda não relatou). */
  appliedVersion: number | null;
  report: PolicyReport | null;
  androidVersion: number;
  securityPatch: string | null;
  now: Date;
}

const DAY = 86_400_000;

export function patchAgeDays(securityPatch: string | null, now: Date): number | null {
  if (!securityPatch) return null;
  return Math.floor((now.getTime() - new Date(`${securityPatch}T00:00:00Z`).getTime()) / DAY);
}

/** Regras avaliadas no servidor a partir do inventário (não dependem do relatório da política). */
export function inventoryReasons(
  settings: PolicySettings,
  device: { androidVersion: number; securityPatch: string | null },
  now: Date,
): ComplianceReason[] {
  const reasons: ComplianceReason[] = [];
  const c = settings.compliance;
  if (device.androidVersion < c.minAndroidVersion) {
    reasons.push({
      code: 'min_android',
      message: `Android ${device.androidVersion} abaixo do mínimo exigido (Android ${c.minAndroidVersion}).`,
      fix: 'Atualize o sistema, se o fabricante oferecer, ou substitua o aparelho.',
    });
  }
  const age = patchAgeDays(device.securityPatch, now);
  if (c.maxSecurityPatchAgeDays != null && age != null && age > c.maxSecurityPatchAgeDays) {
    reasons.push({
      code: 'security_patch',
      message: `Atualização de segurança de ${device.securityPatch} (${age} dias; limite de ${c.maxSecurityPatchAgeDays}).`,
      fix: 'Instale a atualização do sistema disponível no aparelho.',
    });
  }
  return reasons;
}

/** Motivo enquanto o aparelho não relata a versão desejada (estado “desconhecido”, nunca “conforme”). */
export function awaitingDevice(version: number, appliedVersion: number | null = null): ComplianceReason {
  return {
    code: 'awaiting_device',
    message:
      appliedVersion == null
        ? `Aguardando o aparelho aplicar a política (versão ${version}).`
        : `O aparelho relatou a versão ${appliedVersion}; aguardando aplicar a versão ${version}.`,
    fix: 'Nada a fazer: a política é aplicada na próxima comunicação do aparelho.',
  };
}

export function evaluateCompliance(i: ComplianceInput): {
  status: ComplianceStatus;
  reasons: ComplianceReason[];
} {
  if (!i.policy) return { status: 'not_applicable', reasons: [] };
  if (i.appliedVersion == null || i.appliedVersion !== i.policy.version) {
    return { status: 'unknown', reasons: [awaitingDevice(i.policy.version, i.appliedVersion)] };
  }
  const reasons: ComplianceReason[] = [];
  const apps = new Map(i.policy.settings.requiredApps.map((a) => [a.packageName, a.name]));
  for (const n of i.report?.nonCompliance ?? []) {
    if (n.setting === 'screen_lock') {
      reasons.push({
        code: 'screen_lock',
        message: 'Senha de tela ainda não criada pelo responsável.',
        fix: 'Peça ao responsável para criar a senha — o aparelho mostra o aviso automaticamente.',
      });
    } else if (apps.has(n.packageName)) {
      reasons.push({
        code: 'required_app',
        message: `App obrigatório “${apps.get(n.packageName)}” não instalado.`,
        fix: 'Verifique a conexão e o espaço livre; a instalação é tentada de novo automaticamente.',
      });
    }
  }
  reasons.push(...inventoryReasons(i.policy.settings, i, i.now));
  return { status: reasons.length ? 'noncompliant' : 'compliant', reasons };
}
