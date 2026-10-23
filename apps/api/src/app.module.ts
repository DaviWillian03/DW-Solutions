import { type DynamicModule, type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import type { DbHandle } from '@dw/db';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import { AUTH, createAuth } from './auth/auth.js';
import { LoginThrottle } from './auth/login-throttle.js';
import { SessionGuard } from './auth/session.guard.js';
import { ENV, type Env } from './config/env.js';
import { DevicesController } from './devices/devices.controller.js';
import { DevicesService } from './devices/devices.service.js';
import { EnrollmentsService } from './devices/enrollments.service.js';
import { HoldersService } from './devices/holders.service.js';
import { PROVIDER } from './devices/provider.js';
import { SimulatorProvider } from '@dw/simulator';
import { HealthController } from './health/health.controller.js';
import { OriginMiddleware } from './http/origin.middleware.js';
import { RequestIdMiddleware } from './http/request-id.middleware.js';
import { APP_DB, AUTH_DB, InfraModule, REDIS } from './infra/infra.module.js';
import { LOGGER } from './logger.js';
import { UsersController } from './users/users.controller.js';
import { UsersService } from './users/users.service.js';

@Module({})
export class AppModule implements NestModule {
  /** Recebe configuração e logger já validados (facilita testes com dependências trocadas). */
  static register(env: Env, logger: Logger): DynamicModule {
    return {
      module: AppModule,
      global: true,
      imports: [InfraModule],
      controllers: [HealthController, UsersController, DevicesController],
      providers: [
        { provide: ENV, useValue: env },
        { provide: LOGGER, useValue: logger },
        {
          provide: AUTH,
          inject: [APP_DB, AUTH_DB, REDIS],
          useFactory: (appDb: DbHandle, authDb: DbHandle, redis: Redis) =>
            createAuth({ env, appDb, authDb, throttle: new LoginThrottle(redis), logger }),
        },
        { provide: APP_GUARD, useClass: SessionGuard },
        UsersService,
        DevicesService,
        HoldersService,
        EnrollmentsService,
        // ADR-0001: o único provedor ativo é o simulador.
        { provide: PROVIDER, useValue: new SimulatorProvider() },
      ],
      exports: [ENV, LOGGER, AUTH],
    };
  }

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*path');
    consumer.apply(OriginMiddleware).forRoutes('*path');
  }
}
