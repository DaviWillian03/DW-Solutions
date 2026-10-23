import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { tenants, withTenant, type DbHandle, type UserRole } from '@dw/db';
import { fromNodeHeaders } from 'better-auth/node';
import { APP_DB } from '../infra/infra.module.js';
import { AUTH, type Auth } from './auth.js';
import { ALLOW_PENDING_MFA, IS_PUBLIC, ROLES, type AuthedRequest } from './decorators.js';

/**
 * Guarda global (negar por padrão):
 * 1. sessão válida do Better Auth; 2. usuário ativo; 3. empresa ativa;
 * 4. administrador com verificação em duas etapas cadastrada; 5. perfil permitido na rota.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH) private readonly auth: Auth,
    @Inject(APP_DB) private readonly appDb: DbHandle,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const res = ctx.switchToHttp().getResponse<{ locals: { requestId?: string } }>();
    const data = await this.auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!data)
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Faça login para continuar.' });

    const user = data.user as typeof data.user & { tenantId: string; role: UserRole; status: string };
    if (user.status !== 'active') {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Usuário desativado.' });
    }

    const [tenant] = await withTenant(this.appDb.db, user.tenantId, (tx) =>
      tx.select({ status: tenants.status }).from(tenants),
    );
    if (tenant?.status !== 'active') {
      throw new ForbiddenException({ code: 'TENANT_SUSPENDED', message: 'Empresa suspensa.' });
    }

    req.auth = {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      sessionId: data.session.id,
      twoFactorEnabled: Boolean(user.twoFactorEnabled),
      requestId: res.locals.requestId,
      ip: req.ip,
    };

    const allowPending = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_MFA, targets);
    if (user.role === 'admin' && !user.twoFactorEnabled && !allowPending) {
      throw new ForbiddenException({
        code: 'MFA_ENROLLMENT_REQUIRED',
        message: 'Administradores precisam cadastrar a verificação em duas etapas.',
      });
    }

    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES, targets);
    if (roles && !roles.includes(user.role)) {
      throw new ForbiddenException({ code: 'FORBIDDEN_ROLE', message: 'Seu perfil não permite esta ação.' });
    }
    return true;
  }
}
