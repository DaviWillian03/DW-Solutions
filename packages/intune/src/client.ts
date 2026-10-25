// Cliente mínimo do Microsoft Graph para o Intune. Transporte e token são injetados: nos testes nada sai da
// máquina; em produção, só com o aplicativo do Entra criado pela TI e o segredo guardado no ambiente (ADR-0010).
import { TransientProviderError } from '@dw/contracts';

export const GRAPH_BASE = 'https://graph.microsoft.com/';
export type GraphVersion = 'v1.0' | 'beta';

export interface HttpRequest {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  url: string;
  headers: Record<string, string>;
  body?: string;
}
export type Transport = (req: HttpRequest) => Promise<{ status: number; body: unknown }>;

export class GraphError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GraphError';
  }
}

/** IDs do Intune e do Entra são GUIDs: qualquer outra coisa é recusada antes de montar a URL. */
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function id(value: string) {
  if (!GUID.test(value)) throw new GraphError(400, `Identificador inválido: ${value}`);
  return value;
}

/** Ações remotas que o DW Solutions pode pedir (lista fechada; Graph v1.0). */
export const DEVICE_ACTIONS = [
  'remoteLock',
  'rebootNow',
  'wipe',
  'locateDevice',
  'playLostModeSound',
  'syncDevice',
] as const;
export type DeviceAction = (typeof DEVICE_ACTIONS)[number];
/** `playLostModeSound` só existe no /beta (conferido em 2026-10-25); as demais estão no v1.0. */
const ACTION_VERSION: Record<DeviceAction, GraphVersion> = {
  remoteLock: 'v1.0',
  rebootNow: 'v1.0',
  wipe: 'v1.0',
  locateDevice: 'v1.0',
  playLostModeSound: 'beta',
  syncDevice: 'v1.0',
};

export interface ManagedDevicePage {
  value: Record<string, unknown>[];
  '@odata.nextLink'?: string;
}

export class GraphClient {
  constructor(
    private readonly transport: Transport,
    private readonly accessToken: () => Promise<string>,
  ) {}

  private async call<T>(
    method: HttpRequest['method'],
    version: GraphVersion,
    path: string,
    body?: unknown,
  ): Promise<T> {
    return this.send<T>(method, `${GRAPH_BASE}${version}/${path}`, body);
  }

  private async send<T>(method: HttpRequest['method'], url: string, body?: unknown): Promise<T> {
    const res = await this.transport({
      method,
      url,
      headers: {
        authorization: `Bearer ${await this.accessToken()}`,
        'content-type': 'application/json',
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (res.status === 429 || res.status >= 500) {
      throw new TransientProviderError(`Microsoft Graph indisponível (HTTP ${res.status}).`);
    }
    if (res.status >= 400) {
      const m = (res.body as { error?: { message?: string } } | null)?.error?.message ?? 'erro';
      throw new GraphError(res.status, `Microsoft Graph recusou (HTTP ${res.status}): ${m}`);
    }
    return res.body as T;
  }

  async getManagedDevice(deviceId: string) {
    return this.call<Record<string, unknown>>(
      'GET',
      'v1.0',
      `deviceManagement/managedDevices/${id(deviceId)}`,
    );
  }

  /** Lista só Android. A próxima página vem pronta do Graph; só seguimos se for do próprio Graph. */
  async listAndroidDevices(nextLink?: string) {
    if (nextLink) {
      if (!nextLink.startsWith(`${GRAPH_BASE}v1.0/deviceManagement/managedDevices?`)) {
        throw new GraphError(400, 'Próxima página fora do Microsoft Graph.');
      }
      return this.send<ManagedDevicePage>('GET', nextLink);
    }
    const q = new URLSearchParams({ $filter: "operatingSystem eq 'Android'", $top: '100' });
    return this.call<ManagedDevicePage>('GET', 'v1.0', `deviceManagement/managedDevices?${q.toString()}`);
  }

  /** Sucesso = 204: o Intune ACEITOU. O resultado aparece depois em `deviceActionResults`. */
  async deviceAction(deviceId: string, action: DeviceAction, body?: Record<string, unknown>) {
    if (!DEVICE_ACTIONS.includes(action)) throw new GraphError(400, `Ação não permitida: ${action}`);
    await this.call(
      'POST',
      ACTION_VERSION[action],
      `deviceManagement/managedDevices/${id(deviceId)}/${action}`,
      body,
    );
  }

  /** Resultados das ações com a localização (`deviceLocation` só aparece no /beta). */
  async getActionResults(deviceId: string) {
    const r = await this.call<{ deviceActionResults?: Record<string, unknown>[] }>(
      'GET',
      'beta',
      `deviceManagement/managedDevices/${id(deviceId)}?$select=id,deviceActionResults`,
    );
    return r.deviceActionResults ?? [];
  }

  /** Cadastro por QR (/beta). `createToken` responde 204; o QR vem na leitura do perfil. */
  async createEnrollmentToken(profileId: string, validitySeconds: number) {
    const path = `deviceManagement/androidDeviceOwnerEnrollmentProfiles/${id(profileId)}`;
    await this.call('POST', 'beta', `${path}/createToken`, { tokenValidityInSeconds: validitySeconds });
    return this.call<{
      id: string;
      enrollmentMode?: string;
      tokenValue?: string;
      qrCodeContent?: string;
      tokenExpirationDateTime?: string;
    }>('GET', 'beta', `${path}?$select=id,enrollmentMode,tokenValue,qrCodeContent,tokenExpirationDateTime`);
  }

  async createConfiguration(config: Record<string, unknown>) {
    return this.call<{ id: string; version?: number }>(
      'POST',
      'beta',
      'deviceManagement/deviceConfigurations',
      config,
    );
  }

  async updateConfiguration(configId: string, config: Record<string, unknown>) {
    return this.call<unknown>(
      'PATCH',
      'beta',
      `deviceManagement/deviceConfigurations/${id(configId)}`,
      config,
    );
  }

  /** Atribui o perfil ao grupo da política (o grupo é criado pela TI — I-7). */
  async assignConfiguration(configId: string, groupId: string) {
    return this.call<unknown>(
      'POST',
      'beta',
      `deviceManagement/deviceConfigurations/${id(configId)}/assign`,
      {
        assignments: [
          {
            target: { '@odata.type': '#microsoft.graph.groupAssignmentTarget', groupId: id(groupId) },
          },
        ],
      },
    );
  }

  /** Cria UMA atribuição “obrigatória” (não usa /assign, que substituiria as atribuições feitas pela TI). */
  async requireApp(mobileAppId: string, groupId: string) {
    return this.call<{ id: string }>(
      'POST',
      'v1.0',
      `deviceAppManagement/mobileApps/${id(mobileAppId)}/assignments`,
      {
        '@odata.type': '#microsoft.graph.mobileAppAssignment',
        intent: 'required',
        target: { '@odata.type': '#microsoft.graph.groupAssignmentTarget', groupId: id(groupId) },
      },
    );
  }

  async listCompliancePolicies() {
    return this.call<{ value: Record<string, unknown>[] }>(
      'GET',
      'v1.0',
      'deviceManagement/deviceCompliancePolicies?$expand=scheduledActionsForRule($expand=scheduledActionConfigurations)',
    );
  }

  /** Objeto de aparelho no Entra a partir do `azureADDeviceId` do Intune (é ele que entra no grupo). */
  async findEntraDevice(azureAdDeviceId: string) {
    const q = new URLSearchParams({ $filter: `deviceId eq '${id(azureAdDeviceId)}'`, $select: 'id' });
    const r = await this.call<{ value: { id: string }[] }>('GET', 'v1.0', `devices?${q.toString()}`);
    return r.value[0]?.id ?? null;
  }

  async addGroupMember(groupId: string, directoryObjectId: string) {
    return this.call<unknown>('POST', 'v1.0', `groups/${id(groupId)}/members/$ref`, {
      '@odata.id': `${GRAPH_BASE}v1.0/directoryObjects/${id(directoryObjectId)}`,
    });
  }

  async removeGroupMember(groupId: string, directoryObjectId: string) {
    return this.call<unknown>(
      'DELETE',
      'v1.0',
      `groups/${id(groupId)}/members/${id(directoryObjectId)}/$ref`,
    );
  }
}
