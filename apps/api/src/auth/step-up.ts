import { ForbiddenException, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { recordAudit, withTenant, type DbHandle } from '@dw/db';
import { fromNodeHeaders } from 'better-auth/node';
import type { IncomingHttpHeaders } from 'node:http';
import type { Redis } from 'ioredis';
import { APP_DB, REDIS } from '../infra/infra.module.js';
import { AUTH, type Auth } from './auth.js';
import type { AuthContext } from './decorators.js';

/**
 * “Refazer a verificação em duas etapas” antes de ações sensíveis (apagar aparelho, aprovar lote,
 * ligar o apagamento). O Better Auth não limita tentativas nem impede reuso do código quando já existe
 * sessão, então aqui há: até 5 erros em 15 min por usuário e cada código vale uma única vez.
 */
@Injectable()
export class StepUpService {
  static readonly MAX_FAILS = 5;
  static readonly WINDOW = 15 * 60;

  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(APP_DB) private readonly appDb: DbHandle,
  ) {}

  private async ready() {
    if (this.redis.status === 'wait' || this.redis.status === 'end') await this.redis.connect();
  }

  private async denied(a: AuthContext, purpose: string, reason: string) {
    await withTenant(this.appDb.db, a.tenantId, (tx) =>
      recordAudit(tx, {
        tenantId: a.tenantId,
        actorType: 'user',
        actorId: a.userId,
        action: 'security.step_up',
        outcome: 'denied',
        reason,
        metadata: { finalidade: purpose },
        requestId: a.requestId,
        sourceIp: a.ip,
      }),
    );
  }

  async verify(
    a: AuthContext,
    headers: IncomingHttpHeaders,
    code: string | null | undefined,
    purpose: string,
  ) {
    if (!code || !/^\d{6}$/.test(code)) {
      throw new ForbiddenException({
        code: 'STEP_UP_REQUIRED',
        message: 'Digite o código de 6 dígitos do app autenticador para confirmar.',
      });
    }
    await this.ready();
    const failKey = `dw:stepup-fail:${a.userId}`;
    if (Number(await this.redis.get(failKey)) >= StepUpService.MAX_FAILS) {
      await this.denied(a, purpose, 'bloqueado por excesso de tentativas');
      throw new HttpException(
        { code: 'STEP_UP_LOCKED', message: 'Muitas tentativas. Aguarde 15 minutos e tente de novo.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    // Cada código vale uma vez: impede reaproveitar um código visto por outra pessoa.
    const fresh = await this.redis.set(`dw:stepup-used:${a.userId}:${code}`, '1', 'EX', 120, 'NX');
    if (!fresh) {
      await this.denied(a, purpose, 'código reutilizado');
      throw new ForbiddenException({
        code: 'STEP_UP_REUSED',
        message: 'Este código já foi usado. Aguarde o próximo código no app autenticador.',
      });
    }
    try {
      await this.auth.api.verifyTOTP({ body: { code }, headers: fromNodeHeaders(headers) });
    } catch {
      const n = await this.redis.incr(failKey);
      if (n === 1) await this.redis.expire(failKey, StepUpService.WINDOW);
      await this.denied(a, purpose, 'código inválido');
      throw new ForbiddenException({
        code: 'STEP_UP_FAILED',
        message: 'Código inválido. Confira o app e tente de novo.',
      });
    }
    await this.redis.del(failKey);
  }
}
