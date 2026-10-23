import { randomUUID } from 'node:crypto';
import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { Logger } from 'pino';
import { LOGGER } from '../logger.js';

// Aceita IDs de correlação vindos de fora só se tiverem formato seguro (evita injeção em logs).
const SAFE_ID = /^[A-Za-z0-9-]{8,64}$/;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  constructor(@Inject(LOGGER) private readonly logger: Logger) {}

  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.header('x-request-id');
    const requestId = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
    res.locals.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      this.logger.info(
        { requestId, method: req.method, path: req.path, status: res.statusCode, ms: Math.round(ms) },
        'requisição concluída',
      );
    });
    next();
  }
}
