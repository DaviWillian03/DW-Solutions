'use client';

import { passkeyClient } from '@better-auth/passkey/client';
import { twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

/** Cliente do Better Auth. Usa a mesma origem do site (/api/auth é encaminhado para a API). */
export const authClient = createAuthClient({
  basePath: '/api/auth',
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = '/verificacao';
      },
    }),
    passkeyClient(),
  ],
});

/** Mensagens em português para respostas de erro da autenticação. */
export function authErrorMessage(
  err: { status?: number; code?: string; message?: string } | null | undefined,
): string {
  if (!err) return 'Algo deu errado. Tente novamente.';
  if (err.status === 429) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
  if (err.status === 401) return 'E-mail ou senha incorretos.';
  if (err.status === 403) return 'Acesso não permitido para esta conta.';
  if (err.code === 'INVALID_CODE' || err.code === 'INVALID_TWO_FACTOR_CODE')
    return 'Código inválido. Confira o app e tente de novo.';
  return 'Não foi possível concluir. Tente novamente.';
}
