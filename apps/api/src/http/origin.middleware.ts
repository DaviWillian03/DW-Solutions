import { ForbiddenException, Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ENV, type Env } from '../config/env.js';

export const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Origem declarada pelo navegador (Origin, ou Referer como alternativa). */
export function requestOrigin(req: Request): string | undefined {
  return req.header('origin') ?? originFromReferer(req.header('referer'));
}

/**
 * Proteção CSRF das rotas da API (as rotas /api/auth têm checagem equivalente em main.ts):
 * requisições que alteram dados precisam vir da origem do site. Junto com o cookie SameSite=Lax,
 * impede que outro site dispare ações em nome do usuário.
 */
@Injectable()
export class OriginMiddleware implements NestMiddleware {
  constructor(@Inject(ENV) private readonly env: Env) {}

  use(req: Request, _res: Response, next: NextFunction) {
    if (SAFE_METHODS.has(req.method)) return next();
    if (requestOrigin(req) !== this.env.WEB_ORIGIN) {
      throw new ForbiddenException({ code: 'BAD_ORIGIN', message: 'Origem da requisição não permitida.' });
    }
    next();
  }
}

function originFromReferer(referer: string | undefined): string | undefined {
  if (!referer) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}
