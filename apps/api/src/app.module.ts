import { type DynamicModule, type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import type { Logger } from 'pino';
import { ENV, type Env } from './config/env.js';
import { HealthController } from './health/health.controller.js';
import { RequestIdMiddleware } from './http/request-id.middleware.js';
import { InfraModule } from './infra/infra.module.js';
import { LOGGER } from './logger.js';

@Module({})
export class AppModule implements NestModule {
  /** Recebe configuração e logger já validados (facilita testes com dependências trocadas). */
  static register(env: Env, logger: Logger): DynamicModule {
    return {
      module: AppModule,
      global: true,
      imports: [InfraModule],
      controllers: [HealthController],
      providers: [
        { provide: ENV, useValue: env },
        { provide: LOGGER, useValue: logger },
      ],
      exports: [ENV, LOGGER],
    };
  }

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*path');
  }
}
