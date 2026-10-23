import type { LoggerService } from '@nestjs/common';
import { pino, type Logger } from 'pino';

/** Logs estruturados em JSON. Campos sensíveis são redigidos antes de sair do processo. */
export function createLogger(level: string): Logger {
  return pino({
    level,
    base: { service: 'dw-api' },
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token', '*.secret'],
      censor: '[redigido]',
    },
  });
}

/** Adapta o pino para o logger interno do NestJS. */
export class PinoNestLogger implements LoggerService {
  constructor(private readonly logger: Logger) {}

  log(message: unknown, context?: string) {
    this.logger.info({ context }, String(message));
  }
  error(message: unknown, trace?: string, context?: string) {
    this.logger.error({ context, trace }, String(message));
  }
  warn(message: unknown, context?: string) {
    this.logger.warn({ context }, String(message));
  }
  debug(message: unknown, context?: string) {
    this.logger.debug({ context }, String(message));
  }
  verbose(message: unknown, context?: string) {
    this.logger.trace({ context }, String(message));
  }
}

export const LOGGER = Symbol('LOGGER');
