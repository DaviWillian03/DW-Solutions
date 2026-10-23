import { createHash, randomBytes } from 'node:crypto';

export const INVITATION_TTL_MS = 48 * 60 * 60 * 1000;

/** Token aleatório de 256 bits. Só o hash é guardado; o token vai uma única vez para o convidado. */
export function newInvitationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** O token vai no fragmento (#) da URL: não aparece em logs de servidor nem no cabeçalho Referer. */
export function invitationUrl(webOrigin: string, token: string): string {
  return `${webOrigin}/convite#${token}`;
}
