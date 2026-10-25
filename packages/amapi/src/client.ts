// Cliente mínimo da Android Management API (REST v1). Transporte e credencial são injetados: nos testes
// nada sai da máquina; em produção, só com conta de serviço guardada como segredo do ambiente (nunca no Git).
import { TransientProviderError } from '@dw/contracts';

export const AMAPI_BASE = 'https://androidmanagement.googleapis.com/v1/';

export interface HttpRequest {
  method: 'GET' | 'POST' | 'PATCH';
  url: string;
  headers: Record<string, string>;
  body?: string;
}
export type Transport = (req: HttpRequest) => Promise<{ status: number; body: unknown }>;

export class AmapiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AmapiError';
  }
}

/** Nomes de recurso vêm do Google: só aceitamos o formato esperado (evita montar URL com texto qualquer). */
const RESOURCE =
  /^enterprises\/[A-Za-z0-9_-]+(\/(devices|policies|enrollmentTokens|operations)\/[A-Za-z0-9_-][A-Za-z0-9_.-]*)*$/;
function resource(name: string) {
  if (!RESOURCE.test(name)) throw new AmapiError(400, `Nome de recurso inválido: ${name}`);
  return name;
}

export class AmapiClient {
  constructor(
    private readonly transport: Transport,
    private readonly accessToken: () => Promise<string>,
  ) {}

  private async call<T>(method: HttpRequest['method'], path: string, body?: unknown): Promise<T> {
    const res = await this.transport({
      method,
      url: AMAPI_BASE + path,
      headers: {
        authorization: `Bearer ${await this.accessToken()}`,
        'content-type': 'application/json',
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (res.status === 429 || res.status >= 500) {
      throw new TransientProviderError(`Android Management API indisponível (HTTP ${res.status}).`);
    }
    if (res.status >= 400) {
      const m = (res.body as { error?: { message?: string } } | null)?.error?.message ?? 'erro';
      throw new AmapiError(res.status, `Android Management API recusou (HTTP ${res.status}): ${m}`);
    }
    return res.body as T;
  }

  async createEnrollmentToken(enterprise: string, token: Record<string, unknown>) {
    return this.call<{ name: string; value: string; qrCode: string; expirationTimestamp: string }>(
      'POST',
      `${resource(enterprise)}/enrollmentTokens`,
      token,
    );
  }

  async patchPolicy(policyName: string, policy: Record<string, unknown>) {
    return this.call<{ name: string; version: string }>('PATCH', resource(policyName), policy);
  }

  async issueCommand(deviceName: string, command: Record<string, unknown>) {
    return this.call<{ name: string; done?: boolean }>(
      'POST',
      `${resource(deviceName)}:issueCommand`,
      command,
    );
  }

  async getDevice(deviceName: string) {
    return this.call<Record<string, unknown>>('GET', resource(deviceName));
  }

  async listDevices(enterprise: string, pageToken?: string) {
    const q = new URLSearchParams({ pageSize: '100', ...(pageToken ? { pageToken } : {}) });
    return this.call<{ devices?: Record<string, unknown>[]; nextPageToken?: string }>(
      'GET',
      `${resource(enterprise)}/devices?${q.toString()}`,
    );
  }
}
