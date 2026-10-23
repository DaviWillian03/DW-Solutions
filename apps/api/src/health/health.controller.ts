import { Controller, Get, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { Redis } from 'ioredis';
import type { DbHandle } from '@dw/db';
import type { Logger } from 'pino';
import { APP_DB, REDIS } from '../infra/infra.module.js';
import { Public } from '../auth/decorators.js';
import { LOGGER } from '../logger.js';

type CheckStatus = 'up' | 'down';
interface Check {
  status: CheckStatus;
  latencyMs: number;
}

const TIMEOUT_MS = 1_500;

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)),
  ]);
}

@Controller('health')
export class HealthController {
  constructor(
    @Inject(APP_DB) private readonly appDb: DbHandle,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  /** Verifica dependências reais. Nunca devolve detalhes de erro (só registra no log). */
  @Public()
  @Get()
  async check(@Res({ passthrough: true }) res: Response) {
    const [database, redis] = await Promise.all([
      this.probe('database', () => this.appDb.pool.query('SELECT 1')),
      this.probe('redis', async () => {
        if (this.redis.status === 'wait' || this.redis.status === 'end') await this.redis.connect();
        return this.redis.ping();
      }),
    ]);
    const ok = database.status === 'up' && redis.status === 'up';
    res.status(ok ? 200 : 503);
    return {
      status: ok ? 'ok' : 'degraded',
      checkedAt: new Date().toISOString(),
      checks: { database, redis },
    };
  }

  private async probe(name: string, fn: () => Promise<unknown>): Promise<Check> {
    const started = performance.now();
    try {
      await withTimeout(fn());
      return { status: 'up', latencyMs: Math.round(performance.now() - started) };
    } catch (err) {
      this.logger.warn({ dependency: name, err: (err as Error).message }, 'dependência indisponível');
      return { status: 'down', latencyMs: Math.round(performance.now() - started) };
    }
  }
}
