import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { createDb, type DbHandle } from '@dw/db';
import { Redis } from 'ioredis';
import { ENV, type Env } from '../config/env.js';
import { createSimQueue, SIM_QUEUE, type SimQueue } from './queue.js';

/** Banco com o papel dw_app (dados de empresa via withTenant + RLS). */
export const APP_DB = Symbol('APP_DB');
/** Banco com o papel dw_auth (somente identidade/sessões). */
export const AUTH_DB = Symbol('AUTH_DB');
export const REDIS = Symbol('REDIS');

@Global()
@Module({
  providers: [
    { provide: APP_DB, inject: [ENV], useFactory: (env: Env) => createDb(env.DATABASE_URL, 10) },
    { provide: AUTH_DB, inject: [ENV], useFactory: (env: Env) => createDb(env.AUTH_DATABASE_URL, 5) },
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
    {
      provide: SIM_QUEUE,
      inject: [ENV],
      useFactory: (env: Env) => createSimQueue(env.REDIS_URL, env.NODE_ENV, env.QUEUE_PREFIX),
    },
  ],
  exports: [APP_DB, AUTH_DB, REDIS, SIM_QUEUE],
})
export class InfraModule implements OnApplicationShutdown {
  constructor(
    @Inject(APP_DB) private readonly appDb: DbHandle,
    @Inject(AUTH_DB) private readonly authDb: DbHandle,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(SIM_QUEUE) private readonly simQueue: SimQueue,
  ) {}

  async onApplicationShutdown() {
    await Promise.all([this.appDb.close(), this.authDb.close(), this.simQueue.close()]);
    this.redis.disconnect();
  }
}
