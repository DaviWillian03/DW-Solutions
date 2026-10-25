import {
  POLICY_TEMPLATES,
  TransientProviderError,
  UnsupportedCapabilityError,
  type PolicySettings,
} from '@dw/contracts';
import { describe, expect, it } from 'vitest';
import {
  actionProgress,
  assertSafeConfiguration,
  findAutomaticActions,
  fromManagedDevice,
  GraphClient,
  GraphError,
  IntuneDisabledError,
  IntuneProvider,
  toGraphAction,
  toIntuneConfiguration,
  UnsafeIntuneConfigError,
  type HttpRequest,
} from '../src/index.js';

const DEV = '0f0e0d0c-0b0a-4908-8706-050403020100';
const PROFILE_COBO = '11111111-2222-4333-8444-555555555555';
const PROFILE_COSU = '66666666-7777-4888-9999-aaaaaaaaaaaa';
const GROUP = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';
const ENTRA_DEVICE = '99999999-8888-4777-8666-555555555555';
const sales = (): PolicySettings => structuredClone(POLICY_TEMPLATES.sales.settings);

/** Transporte falso: registra as requisições e devolve respostas de exemplo. Nada vai à rede. */
function fakeTransport(responses: { status: number; body: unknown }[]) {
  const sent: HttpRequest[] = [];
  const transport = async (req: HttpRequest) => {
    sent.push(req);
    return responses.shift() ?? { status: 204, body: null };
  };
  return { sent, transport };
}
const client = (t: ReturnType<typeof fakeTransport>) =>
  new GraphClient(t.transport, async () => 'token-de-teste');

describe('política → perfil de configuração do Intune', () => {
  it('converte restrições, tempo de tela e janela de atualização', () => {
    const c = toIntuneConfiguration(sales(), { policyName: 'Vendas', version: 3 });
    expect(c).toMatchObject({
      '@odata.type': '#microsoft.graph.androidDeviceOwnerGeneralDeviceConfiguration',
      displayName: 'DW Solutions — Vendas',
      appsAllowInstallFromUnknownSources: false,
      securityDeveloperSettingsEnabled: false,
      passwordMinutesOfInactivityBeforeScreenTimeout: 2,
      systemUpdateInstallType: 'windowed',
      systemUpdateWindowStartMinutesAfterMidnight: 1320,
      systemUpdateWindowEndMinutesAfterMidnight: 300,
      locateDeviceUserlessDisabled: true,
      locateDeviceLostModeEnabled: true,
    });
    expect(c.description).toContain('versão 3');
  });

  it('atualização automática não leva janela', () => {
    const s = sales();
    s.systemUpdates = { mode: 'automatic' };
    const c = toIntuneConfiguration(s, { policyName: 'Vendas', version: 1 });
    expect(c.systemUpdateInstallType).toBe('automatic');
    expect(c).not.toHaveProperty('systemUpdateWindowStartMinutesAfterMidnight');
  });

  it('NUNCA envia senha, apagar após erros nem bloqueio de redefinição (I-8, I-9)', () => {
    const s = sales();
    expect(s.restrictions.blockFactoryReset).toBe(true); // a política pede, mas não vai ao Intune
    const json = JSON.stringify(toIntuneConfiguration(s, { policyName: 'Vendas', version: 1 }));
    for (const k of [
      'passwordRequiredType',
      'passwordMinimumLength',
      'factoryResetBlocked',
      'FactoryReset',
    ]) {
      expect(json).not.toContain(k);
    }
    for (const bad of [
      { passwordRequiredType: 'numeric' },
      { passwordMinimumLength: 6 },
      { passwordSignInFailureCountBeforeFactoryReset: 5 },
      { workProfilePasswordSignInFailureCountBeforeFactoryReset: 5 },
      { factoryResetBlocked: true },
    ]) {
      expect(() => assertSafeConfiguration(bad)).toThrow(UnsafeIntuneConfigError);
    }
    expect(() =>
      assertSafeConfiguration({ passwordMinutesOfInactivityBeforeScreenTimeout: 5 }),
    ).not.toThrow();
  });

  it('denuncia políticas de conformidade do tenant com ação automática', () => {
    const found = findAutomaticActions([
      {
        id: 'p1',
        displayName: 'Padrão TI',
        scheduledActionsForRule: [
          {
            scheduledActionConfigurations: [
              { actionType: 'block', gracePeriodHours: 0 },
              { actionType: 'notification', gracePeriodHours: 24 },
            ],
          },
        ],
      },
      {
        id: 'p2',
        displayName: 'Só aviso',
        scheduledActionsForRule: [{ scheduledActionConfigurations: [{ actionType: 'pushNotification' }] }],
      },
      {
        id: 'p3',
        displayName: 'Rígida',
        scheduledActionsForRule: [
          { scheduledActionConfigurations: [{ actionType: 'wipe', gracePeriodHours: 240 }] },
        ],
      },
    ]);
    expect(found).toEqual([
      { policyId: 'p1', policyName: 'Padrão TI', action: 'block', afterHours: 0 },
      { policyId: 'p3', policyName: 'Rígida', action: 'wipe', afterHours: 240 },
    ]);
  });
});

describe('comandos → ações do Intune', () => {
  it('bloquear, reiniciar e apagar usam as ações oficiais', () => {
    expect(toGraphAction('lock')).toEqual({ action: 'remoteLock' });
    expect(toGraphAction('reboot')).toEqual({ action: 'rebootNow' });
    expect(toGraphAction('wipe')).toEqual({
      action: 'wipe',
      body: { keepEnrollmentData: false, keepUserData: false, persistEsimDataPlan: true },
    });
  });

  it('modo perdido e limpar dados de app não existem no Intune para Android (I-1)', () => {
    for (const t of ['start_lost_mode', 'stop_lost_mode', 'clear_app_data'] as const) {
      expect(() => toGraphAction(t)).toThrow(UnsupportedCapabilityError);
    }
  });

  it('só um resultado da mesma ação, iniciado depois do envio, muda o estado', () => {
    const sentAt = new Date('2026-10-25T12:00:00Z');
    const old = {
      actionName: 'rebootNow',
      actionState: 'done',
      startDateTime: '2026-10-20T10:00:00Z',
      lastUpdatedDateTime: '2026-10-20T10:05:00Z',
    };
    expect(actionProgress('rebootNow', sentAt, [old])).toBeNull();
    expect(
      actionProgress('rebootNow', sentAt, [
        old,
        { actionName: 'RebootNow', actionState: 'pending', startDateTime: '2026-10-25T12:00:01Z' },
      ]),
    ).toBeNull();
    const done = actionProgress('rebootNow', sentAt, [
      old,
      {
        actionName: 'rebootNow',
        actionState: 'done',
        startDateTime: '2026-10-25T12:00:01Z',
        lastUpdatedDateTime: '2026-10-25T12:04:00Z',
      },
      { actionName: 'remoteLock', actionState: 'failed', startDateTime: '2026-10-25T12:01:00Z' },
    ]);
    expect(done).toMatchObject({ state: 'device_acknowledged' });
    expect(done!.at.toISOString()).toBe('2026-10-25T12:04:00.000Z');
    expect(
      actionProgress('remoteLock', sentAt, [
        { actionName: 'remoteLock', actionState: 'notSupported', startDateTime: '2026-10-25T12:01:00Z' },
      ]),
    ).toMatchObject({ state: 'failed', detail: expect.stringContaining('não suporta') });
  });
});

describe('managedDevice → DW Solutions', () => {
  const sample = {
    id: DEV,
    deviceName: 'VENDAS-R5CX0000',
    managedDeviceOwnerType: 'company' as const,
    operatingSystem: 'Android',
    osVersion: '14',
    androidSecurityPatchLevel: '2026-09-01',
    manufacturer: 'samsung',
    model: 'SM-A256E',
    serialNumber: 'R5CX0000',
    enrolledDateTime: '2026-09-01T10:00:00Z',
    lastSyncDateTime: '2026-10-25T11:50:00Z',
    complianceState: 'compliant',
    azureADDeviceId: ENTRA_DEVICE,
    totalStorageSpaceInBytes: 64e9,
    freeStorageSpaceInBytes: 20e9,
  };

  it('normaliza inventário com horário e marca o que o Intune não informa', () => {
    const d = fromManagedDevice(sample);
    expect(d).toMatchObject({
      providerRef: DEV,
      manufacturer: 'samsung',
      androidVersion: 14,
      securityPatch: '2026-09-01',
      companyOwned: true,
      storage: { totalBytes: 64e9, freeBytes: 20e9, observedAt: '2026-10-25T11:50:00Z' },
      intuneCompliance: 'compliant',
      problems: [],
    });
    expect(d.lastSeenAt?.toISOString()).toBe('2026-10-25T11:50:00.000Z');
    expect(d.notReported).toEqual(['bateria', 'tipo de rede', 'senha de tela']);
  });

  it('desconhecido continua desconhecido; pessoal e não Android aparecem como problema', () => {
    const d = fromManagedDevice({
      id: DEV,
      operatingSystem: 'iOS',
      managedDeviceOwnerType: 'personal',
      manufacturer: 'Xiaomi',
      osVersion: '',
      androidSecurityPatchLevel: 'desconhecido',
      totalStorageSpaceInBytes: 0,
    });
    expect(d).toMatchObject({
      manufacturer: null,
      androidVersion: null,
      securityPatch: null,
      storage: null,
      lastSeenAt: null,
      intuneCompliance: 'unknown',
    });
    expect(d.problems).toHaveLength(2);
  });
});

describe('cliente Graph (sem rede)', () => {
  it('monta as URLs oficiais com token de acesso', async () => {
    const t = fakeTransport([]);
    await client(t).deviceAction(DEV, 'rebootNow');
    expect(t.sent[0]).toMatchObject({
      method: 'POST',
      url: `https://graph.microsoft.com/v1.0/deviceManagement/managedDevices/${DEV}/rebootNow`,
      headers: { authorization: 'Bearer token-de-teste' },
    });
    expect(t.sent[0]!.body).toBeUndefined();
  });

  it('erro 429/5xx é temporário (tenta de novo); 4xx é definitivo', async () => {
    const t = fakeTransport([
      { status: 429, body: {} },
      { status: 403, body: { error: { message: 'Forbidden' } } },
    ]);
    const c = client(t);
    await expect(c.getManagedDevice(DEV)).rejects.toBeInstanceOf(TransientProviderError);
    await expect(c.getManagedDevice(DEV)).rejects.toBeInstanceOf(GraphError);
  });

  it('recusa identificadores fora do formato GUID e ações fora da lista', async () => {
    const t = fakeTransport([]);
    const c = client(t);
    await expect(c.getManagedDevice('../../users')).rejects.toBeInstanceOf(GraphError);
    await expect(c.deviceAction(`${DEV}/../x`, 'wipe')).rejects.toBeInstanceOf(GraphError);
    // @ts-expect-error ação fora da lista fechada
    await expect(c.deviceAction(DEV, 'retire')).rejects.toBeInstanceOf(GraphError);
    expect(t.sent).toHaveLength(0);
  });

  it('só segue a próxima página se ela for do próprio Graph', async () => {
    const t = fakeTransport([{ status: 200, body: { value: [] } }]);
    const c = client(t);
    await expect(
      c.listAndroidDevices('https://evil.example/v1.0/deviceManagement/managedDevices?x'),
    ).rejects.toBeInstanceOf(GraphError);
    await c.listAndroidDevices();
    expect(new URL(t.sent[0]!.url).searchParams.get('$filter')).toBe("operatingSystem eq 'Android'");
  });

  it('app obrigatório vira UMA atribuição “required” ao grupo (não substitui as da TI)', async () => {
    const t = fakeTransport([{ status: 201, body: { id: 'a1' } }]);
    await client(t).requireApp(PROFILE_COBO, GROUP);
    expect(t.sent[0]!.url).toBe(
      `https://graph.microsoft.com/v1.0/deviceAppManagement/mobileApps/${PROFILE_COBO}/assignments`,
    );
    expect(JSON.parse(t.sent[0]!.body!)).toMatchObject({
      intent: 'required',
      target: { groupId: GROUP },
    });
  });

  it('membro de grupo usa o objeto de aparelho do Entra', async () => {
    const t = fakeTransport([{ status: 200, body: { value: [{ id: PROFILE_COSU }] } }]);
    const c = client(t);
    const obj = await c.findEntraDevice(ENTRA_DEVICE);
    await c.addGroupMember(GROUP, obj!);
    await c.removeGroupMember(GROUP, obj!);
    expect(new URL(t.sent[0]!.url).searchParams.get('$filter')).toBe(`deviceId eq '${ENTRA_DEVICE}'`);
    expect(t.sent[1]).toMatchObject({
      method: 'POST',
      url: `https://graph.microsoft.com/v1.0/groups/${GROUP}/members/$ref`,
    });
    expect(JSON.parse(t.sent[1]!.body!)).toEqual({
      '@odata.id': `https://graph.microsoft.com/v1.0/directoryObjects/${PROFILE_COSU}`,
    });
    expect(t.sent[2]).toMatchObject({
      method: 'DELETE',
      url: `https://graph.microsoft.com/v1.0/groups/${GROUP}/members/${PROFILE_COSU}/$ref`,
    });
  });
});

describe('provedor real', () => {
  const profiles = { fully_managed: PROFILE_COBO, dedicated: PROFILE_COSU };

  it('DESLIGADO por padrão: recusa antes de qualquer acesso à rede', async () => {
    const t = fakeTransport([]);
    const p = new IntuneProvider({ client: client(t), enrollmentProfiles: profiles, enabled: false });
    await expect(
      p.issueCommand({ tenantId: 't', commandId: 'c', deviceProviderRef: DEV, type: 'lock', params: {} }),
    ).rejects.toBeInstanceOf(IntuneDisabledError);
    await expect(
      p.createEnrollmentToken({ tenantId: 't', managementMode: 'fully_managed', durationMinutes: 60 }),
    ).rejects.toBeInstanceOf(IntuneDisabledError);
    expect(t.sent).toHaveLength(0);
    const caps = p.getCapabilities();
    expect(caps['command.lost_mode'].status).toBe('unsupported');
    expect(caps['command.clear_app_data'].status).toBe('unsupported');
    expect(caps['telemetry.battery'].status).toBe('unsupported');
    expect(caps['location.continuous'].status).toBe('unsupported');
  });

  it('ligado (só em teste): cadastro pelo perfil do modo e comando aceito ≠ aplicado', async () => {
    const t = fakeTransport([
      { status: 204, body: null },
      {
        status: 200,
        body: {
          id: PROFILE_COSU,
          enrollmentMode: 'corporateOwnedDedicatedDevice',
          tokenValue: 'TOKEN',
          qrCodeContent: '{"android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME":"..."}',
          tokenExpirationDateTime: '2026-10-25T13:00:00Z',
        },
      },
      { status: 204, body: null },
    ]);
    const p = new IntuneProvider({ client: client(t), enrollmentProfiles: profiles, enabled: true });
    const tok = await p.createEnrollmentToken({
      tenantId: 't1',
      managementMode: 'dedicated',
      durationMinutes: 60,
    });
    expect(t.sent[0]!.url).toBe(
      `https://graph.microsoft.com/beta/deviceManagement/androidDeviceOwnerEnrollmentProfiles/${PROFILE_COSU}/createToken`,
    );
    expect(JSON.parse(t.sent[0]!.body!)).toEqual({ tokenValidityInSeconds: 3600 });
    expect(tok).toMatchObject({ token: 'TOKEN', demo: false, providerRef: PROFILE_COSU });
    expect(tok.expiresAt.toISOString()).toBe('2026-10-25T13:00:00.000Z');

    const r = await p.issueCommand({
      tenantId: 't1',
      commandId: 'c1',
      deviceProviderRef: DEV,
      type: 'wipe',
      params: {},
    });
    expect(t.sent[2]!.url).toBe(
      `https://graph.microsoft.com/v1.0/deviceManagement/managedDevices/${DEV}/wipe`,
    );
    expect(r.providerRef).toBe(`${DEV}/wipe`);
  });

  it('ligado: modo perdido é recusado sem chamar o Graph', async () => {
    const t = fakeTransport([]);
    const p = new IntuneProvider({ client: client(t), enrollmentProfiles: profiles, enabled: true });
    await expect(
      p.issueCommand({
        tenantId: 't1',
        commandId: 'c1',
        deviceProviderRef: DEV,
        type: 'start_lost_mode',
        params: { message: 'Devolva na loja' },
      }),
    ).rejects.toBeInstanceOf(UnsupportedCapabilityError);
    expect(t.sent).toHaveLength(0);
  });
});
