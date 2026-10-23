import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { USER_ROLES } from '@dw/db';
import { z } from 'zod';
import { AllowPendingMfa, CurrentAuth, Public, Roles, type AuthContext } from '../auth/decorators.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { UsersService } from './users.service.js';

const inviteSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(USER_ROLES),
});

const disableSchema = z.object({ reason: z.string().trim().min(5).max(500) });

const acceptSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'token inválido'),
  password: z.string().min(12, 'mínimo de 12 caracteres').max(128),
});

const idParam = z.string().uuid();

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** Dados do usuário logado. Permitida antes do cadastro de MFA para a tela saber o que pedir. */
  @AllowPendingMfa()
  @Get('me')
  me(@CurrentAuth() a: AuthContext) {
    return this.users.me(a);
  }

  @Get('users')
  list(@CurrentAuth() a: AuthContext) {
    return this.users.list(a);
  }

  @Roles('admin')
  @Post('users/invite')
  invite(@CurrentAuth() a: AuthContext, @Body(new ZodPipe(inviteSchema)) body: z.infer<typeof inviteSchema>) {
    return this.users.invite(a, body);
  }

  @Roles('admin')
  @HttpCode(204)
  @Post('users/:id/disable')
  async disable(
    @CurrentAuth() a: AuthContext,
    @Param('id', new ZodPipe(idParam)) id: string,
    @Body(new ZodPipe(disableSchema)) body: z.infer<typeof disableSchema>,
  ) {
    await this.users.disable(a, id, body.reason);
  }

  @Public()
  @Post('invitations/accept')
  accept(@Body(new ZodPipe(acceptSchema)) body: z.infer<typeof acceptSchema>) {
    return this.users.acceptInvitation(body.token, body.password);
  }
}
