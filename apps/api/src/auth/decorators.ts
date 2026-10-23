import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { UserRole } from '@dw/db';
import type { Request } from 'express';

export const IS_PUBLIC = 'dw:public';
export const ROLES = 'dw:roles';
export const ALLOW_PENDING_MFA = 'dw:allow-pending-mfa';

/** Rota acessível sem login. Tudo que não tiver este decorador exige sessão (negar por padrão). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Perfis que podem usar a rota. Sem o decorador: qualquer usuário autenticado da empresa. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES, roles);

/** Rota permitida para administrador que ainda não cadastrou a verificação em duas etapas. */
export const AllowPendingMfa = () => SetMetadata(ALLOW_PENDING_MFA, true);

export interface AuthContext {
  userId: string;
  tenantId: string;
  role: UserRole;
  sessionId: string;
  twoFactorEnabled: boolean;
  requestId: string | undefined;
  ip: string | undefined;
}

export type AuthedRequest = Request & { auth?: AuthContext };

export const CurrentAuth = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthContext => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  if (!req.auth) throw new Error('CurrentAuth usado em rota sem autenticação');
  return req.auth;
});
