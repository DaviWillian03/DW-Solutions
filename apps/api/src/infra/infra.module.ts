import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import pg from 'pg';
import { ENV, type Env } from '../config/env.js';

export const PG_POOL = Symbol('PG_POOL');
export const REDIS = Symbol('REDIS');

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ENV],
      useFactory: (env: Env) =>
        new pg.Pool({ connectionString: env.DATABASE_URL, max: 10, connectionTimeoutMillis: 2_000 }),
    },
    {
      provide: REDIS,
      inject: [ENV],
      useFactory: (env: Env) =>
        new Redis(env.REDIS_URL, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          connectTimeout: 2_000,
          // Sem reconexão infinita silenciosa: o health check reporta a indisponibilidade.
          retryStrategy: (times) => (times > 3 ? null : times * 200),
        }),
    },
  ],
  exports: [PG_POOL, REDIS],
})
export class InfraModule implements OnApplicationShutdown {
  constructor(
    @Inject(PG_POOL) private readonly pool: pg.Pool,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async onApplicationShutdown() {
    await this.pool.end();
    this.redis.disconnect();
  }
}
