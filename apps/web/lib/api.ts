'use client';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
    readonly body: Record<string, unknown> | null = null,
  ) {
    super(message);
  }
}

/** Chamada à API na mesma origem (cookies de sessão HttpOnly vão automaticamente). */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', ...init.headers },
  });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body?.code, body?.message ?? 'Erro inesperado.', body);
  }
  return body as T;
}

export interface Me {
  user: { id: string; name: string; email: string; role: 'admin' | 'viewer'; twoFactorEnabled: boolean };
  tenant: { id: string; name: string };
  mfaRequired: boolean;
}
