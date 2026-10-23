import { describe, expect, it } from 'vitest';
import {
  diffPolicySettings,
  evaluateCompliance,
  policySettingsSchema,
  POLICY_TEMPLATES,
  type PolicySettings,
} from '../src/index.js';

const sales = POLICY_TEMPLATES.sales.settings;
const now = new Date('2026-10-23T12:00:00Z');
const clone = (s: PolicySettings): PolicySettings => structuredClone(s);

describe('esquema de política', () => {
  it('aceita os dois modelos prontos', () => {
    expect(policySettingsSchema.safeParse(sales).success).toBe(true);
    expect(policySettingsSchema.safeParse(POLICY_TEMPLATES.merchandising.settings).success).toBe(true);
  });

  it('recusa campos desconhecidos, pacote inválido, app repetido e janela vazia', () => {
    expect(policySettingsSchema.safeParse({ ...sales, wipeOnNonCompliance: true }).success).toBe(false);
    const badPkg = clone(sales);
    badPkg.requiredApps = [{ packageName: 'Não É Pacote', name: 'X' }];
    expect(policySettingsSchema.safeParse(badPkg).success).toBe(false);
    const dup = clone(sales);
    dup.requiredApps = [sales.requiredApps[0]!, sales.requiredApps[0]!];
    expect(policySettingsSchema.safeParse(dup).success).toBe(false);
    const win = clone(sales);
    win.systemUpdates = { mode: 'windowed', startMinute: 60, endMinute: 60 };
    expect(policySettingsSchema.safeParse(win).success).toBe(false);
  });

  it('limita senha e bloqueio automático a valores seguros', () => {
    const s = clone(sales);
    s.screenLock.minLength = 2;
    expect(policySettingsSchema.safeParse(s).success).toBe(false);
    s.screenLock.minLength = 6;
    s.screenLock.autoLockMinutes = 0;
    expect(policySettingsSchema.safeParse(s).success).toBe(false);
  });
});

describe('comparação de versões', () => {
  it('sem mudanças → lista vazia', () => {
    expect(diffPolicySettings(sales, clone(sales))).toEqual([]);
  });

  it('descreve mudanças em português, incluindo apps adicionados e removidos', () => {
    const b = clone(sales);
    b.screenLock.autoLockMinutes = 5;
    b.compliance.minAndroidVersion = 13;
    b.requiredApps = [sales.requiredApps[0]!, { packageName: 'exemplo.vendas.rotas', name: 'Rotas' }];
    const d = diffPolicySettings(sales, b);
    expect(d).toContainEqual({
      key: 'screenLock.autoLockMinutes',
      label: 'Bloqueio automático da tela',
      from: 'Após 2 min sem uso',
      to: 'Após 5 min sem uso',
    });
    expect(d.find((c) => c.key === 'compliance.minAndroidVersion')?.to).toBe('Android 13');
    expect(d.find((c) => c.key === 'requiredApps.exemplo.vendas.rotas')?.from).toBe('—');
    expect(d.find((c) => c.key === 'requiredApps.exemplo.vendas.catalogo')?.to).toBe('—');
  });
});

describe('avaliação de conformidade', () => {
  const base = {
    policy: { version: 2, settings: sales },
    appliedVersion: 2,
    report: { nonCompliance: [] },
    androidVersion: 14,
    securityPatch: '2026-09-01',
    now,
  };

  it('sem política → não se aplica', () => {
    expect(evaluateCompliance({ ...base, policy: null }).status).toBe('not_applicable');
  });

  it('versão ainda não aplicada → desconhecido com motivo (nunca “conforme” por suposição)', () => {
    const never = evaluateCompliance({ ...base, appliedVersion: null, report: null });
    expect(never.status).toBe('unknown');
    expect(never.reasons[0]!.code).toBe('awaiting_device');
    const old = evaluateCompliance({ ...base, appliedVersion: 1 });
    expect(old.status).toBe('unknown');
    expect(old.reasons[0]!.message).toContain('versão 1');
  });

  it('conforme quando o relatório não aponta problemas', () => {
    expect(evaluateCompliance(base)).toEqual({ status: 'compliant', reasons: [] });
  });

  it('não conforme com motivo e correção para cada regra', () => {
    const r = evaluateCompliance({
      ...base,
      androidVersion: 12,
      securityPatch: '2025-12-01',
      policy: {
        version: 2,
        settings: { ...sales, compliance: { minAndroidVersion: 13, maxSecurityPatchAgeDays: 180 } },
      },
      report: {
        nonCompliance: [
          { setting: 'screen_lock', reason: 'user_action' },
          { setting: 'required_app', packageName: 'exemplo.vendas.pedidos', reason: 'app_not_installed' },
        ],
      },
    });
    expect(r.status).toBe('noncompliant');
    expect(r.reasons.map((x) => x.code).sort()).toEqual([
      'min_android',
      'required_app',
      'screen_lock',
      'security_patch',
    ]);
    expect(r.reasons.every((x) => x.fix)).toBe(true);
  });

  it('ignora relato de app que não é mais exigido pela versão aplicada', () => {
    const r = evaluateCompliance({
      ...base,
      report: {
        nonCompliance: [
          { setting: 'required_app', packageName: 'exemplo.antigo', reason: 'app_not_installed' },
        ],
      },
    });
    expect(r.status).toBe('compliant');
  });
});
