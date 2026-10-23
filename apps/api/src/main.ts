import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';
import { createLogger, PinoNestLogger } from './logger.js';

export async function createApp(env = loadEnv()) {
  const logger = createLogger(env.LOG_LEVEL);
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(env, logger), {
    logger: new PinoNestLogger(logger),
  });
  app.disable('x-powered-by');
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
