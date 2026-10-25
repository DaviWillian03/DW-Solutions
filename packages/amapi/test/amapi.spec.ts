import {
  POLICY_TEMPLATES,
  TransientProviderError,
  evaluateCompliance,
  type PolicySettings,
} from '@dw/contracts';
import { describe, expect, it } from 'vitest';
import {
  AmapiClient,
  AmapiError,
  AndroidManagementProvider,
  assertNoAutoEnforcement,
  fromAmapiDevice,
  ProviderDisabledError,
  toAmapiCommand,
  toAmapiPolicy,
  UnsafePolicyError,
  type HttpRequest,
} from '../src/index.js';

const sales = (): PolicySettings => structuredClone(POLICY_TEMPLATES.sales.settings);

/** Transporte falso: registra as requisições e devolve respostas de exemplo. Nada vai à rede. */
function fakeTransport(responses: { status: number; body: unknown }[]) {
  const sent: HttpRequest[] = [];
  const transport = async (req: HttpRequest) => {
    sent.push(req);
    return responses.shift() ?? { status: 200, body: {} };
  };
  return { sent, transport };
}

describe('política → AMAPI', () => {
  it('converte apps, restrições, bloqueio automático e atualizações', () => {
    const p = toAmapiPolicy(sales());
    expect(p.applications).toEqual([
      { packageName: 'exemplo.vendas.pedidos', installType: 'FORCE_INSTALLED' },
      { packageName: 'exemplo.vendas.catalogo', installType: 'FORCE_INSTALLED' },
    ]);
    expect(p.advancedSecurityOverrides).toEqual({
      untrustedAppsPolicy: 'DISALLOW_INSTALL',
      developerSettings: 'DEVELOPER_SETTINGS_DISABLED',
    });
    expect(p.factoryResetDisabled).toBe(true);
    expect(p.maximumTimeToLock).toBe('120000');
    expect(p.systemUpdate).toEqual({ type: 'WINDOWED', startMinutes: 1320, endMinutes: 300 });
    expect(p.statusReportingSettings.deviceSettingsEnabled).toBe(true);
  });

  it('libera fontes desconhecidas/depuração quando a política permite', () => {
    const s = sales();
    s.restrictions = { blockUnknownSources: false, blockUsbDebugging: false, blockFactoryReset: false };
    s.systemUpdates = { mode: 'automatic' };
    const p = toAmapiPolicy(s);
    expect(p.advancedSecurityOverrides.untrustedAppsPolicy).toBe('ALLOW_INSTALL_DEVICE_WIDE');
    expect(p.advancedSecurityOverrides.developerSettings).toBe('DEVELOPER_SETTINGS_ALLOWED');
    expect(p.systemUpdate).toEqual({ type: 'AUTOMATIC' });
  });

  it('NUNCA envia senha, versão mínima ou regras que bloqueiam/apagam automaticamente (CP6-7/8)', () => {
    const json = JSON.stringify(toAmapiPolicy(sales()));
    for (const k of [
      'passwordPolicies',
      'passwordRequirements',
      'minimumApiLevel',
      'policyEnforcementRules',
    ]) {
      expect(json).not.toContain(k);
    }
    expect(() => assertNoAutoEnforcement({ passwordPolicies: [] })).toThrow(UnsafePolicyError);
    expect(() => assertNoAutoEnforcement({ policyEnforcementRules: [] })).toThrow(UnsafePolicyError);
    expect(() => assertNoAutoEnforcement({ applications: [] })).not.toThrow();
  });
});

describe('comandos → issueCommand', () => {
  it('usa os tipos oficiais e a validade do DW Solutions (não os 10 min padrão)', () => {
    expect(toAmapiCommand('lock', {})).toEqual({ type: 'LOCK', duration: '86400s' });
    expect(toAmapiCommand('reboot', {}).type).toBe('REBOOT');
    expect(toAmapiCommand('wipe', {})).toMatchObject({ type: 'WIPE', duration: `${30 * 86400}s` });
    expect(toAmapiCommand('clear_app_data', { packageNames: ['exemplo.vendas.pedidos'] })).toMatchObject({
      type: 'CLEAR_APP_DATA',
      clearAppsDataParams: { packageNames: ['exemplo.vendas.pedidos'] },
    });
  });

  it('modo perdido leva mensagem e telefone em português', () => {
    const c = toAmapiCommand('start_lost_mode', { message: 'Devolva na loja', phone: '11 4000-0000' });
    expect(c).toMatchObject({
      type: 'START_LOST_MODE',
      startLostModeParams: {
        lostMessage: { defaultMessage: 'Devolva na loja', localizedMessages: { 'pt-BR': 'Devolva na loja' } },
        lostPhoneNumber: { defaultMessage: '11 4000-0000' },
      },
    });
  });
});

describe('Device da AMAPI → DW Solutions', () => {
  const now = new Date('2026-10-25T12:00:00Z');
  const sample = {
    name: 'enterprises/LC0abc/devices/3a1f',
    state: 'ACTIVE',
    appliedPolicyVersion: '4',
    lastStatusReportTime: '2026-10-25T11:50:00Z',
    enrollmentTime: '2026-09-01T10:00:00Z',
    hardwareInfo: { manufacturer: 'samsung', model: 'SM-A256E', serialNumber: 'R5CX0000' },
    softwareInfo: { androidVersion: '14', securityPatchLevel: '2026-09-01' },
    deviceSettings: { isDeviceSecure: false },
    nonComplianceDetails: [
      {
        settingName: 'applications',
        nonComplianceReason: 'APP_NOT_INSTALLED',
        packageName: 'exemplo.vendas.pedidos',
      },
      { settingName: 'systemUpdate', nonComplianceReason: 'PENDING' },
    ],
    powerManagementEvents: [
      { eventType: 'BATTERY_LEVEL_COLLECTED', createTime: '2026-10-25T09:00:00Z', batteryLevel: 80 },
      { eventType: 'BATTERY_LEVEL_COLLECTED', createTime: '2026-10-25T11:45:00Z', batteryLevel: 61.4 },
    ],
  };

  it('normaliza inventário com horário e relatório de conformidade', () => {
    const d = fromAmapiDevice(sample);
    expect(d).toMatchObject({
      providerRef: 'enterprises/LC0abc/devices/3a1f',
      manufacturer: 'samsung',
      androidVersion: 14,
      securityPatch: '2026-09-01',
      appliedPolicyVersion: 4,
      managed: true,
      lost: false,
      battery: { value: 61, observedAt: '2026-10-25T11:45:00Z' },
    });
    expect(d.lastSeenAt?.toISOString()).toBe('2026-10-25T11:50:00.000Z');
    expect(d.report.nonCompliance.map((n) => n.setting).sort()).toEqual(['required_app', 'screen_lock']);
    // O que ainda não é interpretado aparece — não some.
    expect(d.unmapped).toEqual(['systemUpdate: PENDING']);
  });

  it('o relatório entra na mesma avaliação de conformidade usada no simulador', () => {
    const d = fromAmapiDevice(sample);
    const r = evaluateCompliance({
      policy: { version: 4, settings: sales() },
      appliedVersion: d.appliedPolicyVersion,
      report: d.report,
      androidVersion: d.androidVersion!,
      securityPatch: d.securityPatch,
      now,
    });
    expect(r.status).toBe('noncompliant');
    expect(r.reasons.map((x) => x.code).sort()).toEqual(['required_app', 'screen_lock']);
  });

  it('fabricante fora do escopo (CP0-3) fica sem marca, sem quebrar', () => {
    expect(
      fromAmapiDevice({ name: 'enterprises/x/devices/y', hardwareInfo: { manufacturer: 'Xiaomi' } })
        .manufacturer,
    ).toBeNull();
  });
});

describe('cliente REST (sem rede)', () => {
  it('monta as URLs oficiais com token de acesso', async () => {
    const { sent, transport } = fakeTransport([
      { status: 200, body: { name: 'enterprises/LC0abc/operations/1' } },
    ]);
    const c = new AmapiClient(transport, async () => 'token-de-teste');
    await c.issueCommand('enterprises/LC0abc/devices/3a1f', { type: 'LOCK' });
    expect(sent[0]).toMatchObject({
      method: 'POST',
      url: 'https://androidmanagement.googleapis.com/v1/enterprises/LC0abc/devices/3a1f:issueCommand',
      headers: { authorization: 'Bearer token-de-teste' },
    });
  });

  it('erro 429/5xx é temporário (tenta de novo); 4xx é definitivo', async () => {
    const { transport } = fakeTransport([
      { status: 503, body: {} },
      { status: 403, body: { error: { message: 'quota' } } },
    ]);
    const c = new AmapiClient(transport, async () => 't');
    await expect(c.getDevice('enterprises/a/devices/b')).rejects.toBeInstanceOf(TransientProviderError);
    await expect(c.getDevice('enterprises/a/devices/b')).rejects.toBeInstanceOf(AmapiError);
  });

  it('recusa nome de recurso fora do formato do Google', async () => {
    const c = new AmapiClient(fakeTransport([]).transport, async () => 't');
    await expect(c.getDevice('enterprises/a/../../outro')).rejects.toBeInstanceOf(AmapiError);
    await expect(c.getDevice('https://evil.example/x')).rejects.toBeInstanceOf(AmapiError);
    await expect(c.getDevice('enterprises/a/devices/..')).rejects.toBeInstanceOf(AmapiError);
  });
});

describe('provedor real', () => {
  it('DESLIGADO por padrão: recusa antes de qualquer acesso à rede', async () => {
    const { sent, transport } = fakeTransport([]);
    const p = new AndroidManagementProvider({
      client: new AmapiClient(transport, async () => 't'),
      enterpriseName: 'enterprises/LC0abc',
      enabled: false,
    });
    await expect(
      p.issueCommand({
        tenantId: 't',
        commandId: 'c',
        deviceProviderRef: 'enterprises/LC0abc/devices/1',
        type: 'lock',
        params: {},
      }),
    ).rejects.toBeInstanceOf(ProviderDisabledError);
    await expect(
      p.createEnrollmentToken({ tenantId: 't', managementMode: 'fully_managed', durationMinutes: 60 }),
    ).rejects.toBeInstanceOf(ProviderDisabledError);
    expect(sent).toHaveLength(0);
    expect(p.getCapabilities()['location.continuous'].status).toBe('unsupported');
  });

  it('ligado (só em teste): token de cadastro e comando usam os formatos oficiais', async () => {
    const { sent, transport } = fakeTransport([
      {
        status: 200,
        body: {
          name: 'enterprises/LC0abc/enrollmentTokens/tk1',
          value: 'ABCDEF',
          qrCode: '{"android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME":"..."}',
          expirationTimestamp: '2026-10-25T13:00:00Z',
        },
      },
      { status: 200, body: { name: 'enterprises/LC0abc/devices/1/operations/9' } },
    ]);
    const p = new AndroidManagementProvider({
      client: new AmapiClient(transport, async () => 't'),
      enterpriseName: 'enterprises/LC0abc',
      enabled: true,
    });
    const tok = await p.createEnrollmentToken({
      tenantId: 't1',
      managementMode: 'dedicated',
      durationMinutes: 60,
    });
    expect(tok.demo).toBe(false);
    expect(JSON.parse(sent[0]!.body!)).toMatchObject({
      duration: '3600s',
      oneTimeOnly: true,
      allowPersonalUsage: 'PERSONAL_USAGE_DISALLOWED_USERLESS',
    });
    const r = await p.issueCommand({
      tenantId: 't1',
      commandId: 'c1',
      deviceProviderRef: 'enterprises/LC0abc/devices/1',
      type: 'reboot',
      params: {},
    });
    // Aceite do Google ≠ aplicado: só a referência da operação volta.
    expect(r.providerRef).toBe('enterprises/LC0abc/devices/1/operations/9');
  });
});
