// Worker do SIMULADOR (ADR-0001/0002): conclui cadastros por QR de demonstração e roda o ciclo de
// comunicação dos aparelhos sintéticos. Nenhum aparelho real é tocado.
import { queuePrefix, SIMULATOR_QUEUE, type SimulatorEnrollJob } from '@dw/contracts';
import { createDb } from '@dw/db';
import { Queue, Worker } from 'bullmq';
import { pino } from 'pino';
import { z } from 'zod';
import { processEnroll, processTick } from './processors.js';

const env = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z.string().default('info'),
    DATABASE_URL: z.string().url(),
    PLATFORM_DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    SIM_TICK_SECONDS: z.coerce.number().int().min(5).max(3600).default(60),
    SIM_ENROLL_DELAY_MS: z.coerce.number().int().min(0).max(60_000).default(3000),
    QUEUE_PREFIX: z
      .string()
      .regex(/^[a-z0-9-]{2,20}$/)
      .optional(),
  })
  .parse(process.env);

const logger = pino({ level: env.LOG_LEVEL, base: { service: 'dw-worker' } });
const appDb = createDb(env.DATABASE_URL, 5);
const platformDb = createDb(env.PLATFORM_DATABASE_URL, 1);
const u = new URL(env.REDIS_URL);
const connection = { host: u.hostname, port: Number(u.port || 6379), maxRetriesPerRequest: null };
const prefix = env.QUEUE_PREFIX ?? queuePrefix(env.NODE_ENV);

const queue = new Queue(SIMULATOR_QUEUE, { connection, prefix });
await queue.upsertJobScheduler('ciclo-simulador', { every: env.SIM_TICK_SECONDS * 1000 }, { name: 'tick' });

const worker = new Worker<SimulatorEnrollJob | Record<string, never>>(
  SIMULATOR_QUEUE,
  async (job) => {
    if (job.name === 'enroll') {
      // Atraso proposital: no mundo real o aparelho leva um tempo para concluir o provisionamento.
      await new Promise((r) => setTimeout(r, env.SIM_ENROLL_DELAY_MS));
      return processEnroll({ appDb, platformDb, logger }, job.data as SimulatorEnrollJob);
    }
    if (job.name === 'tick') return processTick({ appDb, platformDb, logger });
    throw new Error(`tarefa desconhecida: ${job.name}`);
  },
  { connection, prefix, concurrency: 4 },
);

worker.on('failed', (job, err) =>
  logger.error({ job: job?.name, id: job?.id, err: err.message }, 'tarefa falhou'),
);
logger.info({ tickSeconds: env.SIM_TICK_SECONDS }, 'worker do simulador iniciado');

const shutdown = async () => {
  logger.info('encerrando worker');
  await worker.close();
  await queue.close();
  await Promise.all([appDb.close(), platformDb.close()]);
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
