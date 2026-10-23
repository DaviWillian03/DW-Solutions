import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { toNodeHandler } from 'better-auth/node';
import express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { AUTH, type Auth } from './auth/auth.js';
import { loadEnv } from './config/env.js';
import { requestOrigin, SAFE_METHODS } from './http/origin.middleware.js';
import { createLogger, PinoNestLogger } from './logger.js';

export async function createApp(env = loadEnv()) {
  const logger = createLogger(env.LOG_LEVEL);
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(env, logger), {
    logger: new PinoNestLogger(logger),
    // O Better Auth precisa do corpo bruto; o parser JSON é registrado depois da rota dele.
    bodyParser: false,
  });
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(helmet());

  const auth = app.get<Auth>(AUTH);
  const authHandler = toNodeHandler(auth);
  app
    .getHttpAdapter()
    .getInstance()
    .all('/api/auth/*splat', (req: express.Request, res: express.Response) => {
      res.setHeader('x-request-id', randomUUID());
      res.setHeader('cache-control', 'no-store');
      // Defesa extra contra CSRF de login: a biblioteca só confere a origem quando há cookie.
      // Todo POST de autenticação precisa vir do site (navegadores sempre enviam Origin em POST).
      if (!SAFE_METHODS.has(req.method) && requestOrigin(req) !== env.WEB_ORIGIN) {
        res
          .status(403)
          .json({ statusCode: 403, code: 'BAD_ORIGIN', message: 'Origem da requisição não permitida.' });
        return;
      }
      void authHandler(req, res);
    });
  app.use(express.json({ limit: '64kb' }));

  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.enableShutdownHooks();
  return { app, env, logger };
}

async function bootstrap() {
  const { app, env, logger } = await createApp();
  // Só escuta localmente: nada é exposto à internet nesta fase (ADR-0006).
  await app.listen(env.API_PORT, '127.0.0.1');
  logger.info({ port: env.API_PORT }, 'API DW Solutions iniciada');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  bootstrap().catch((err: unknown) => {
    console.error('Falha ao iniciar a API:', (err as Error).message);
    process.exit(1);
  });
}
