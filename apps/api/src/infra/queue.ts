import { queuePrefix, SIMULATOR_QUEUE, type SimulatorEnrollJob } from '@dw/contracts';
import { Queue } from 'bullmq';

export const SIM_QUEUE = Symbol('SIM_QUEUE');

/** Converte REDIS_URL em opções de conexão do BullMQ. */
export function redisConnection(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    username: u.username || undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    db: u.pathname.length > 1 ? Number(u.pathname.slice(1)) : 0,
    tls: u.protocol === 'rediss:' ? {} : undefined,
  };
}

export type SimQueue = Queue<SimulatorEnrollJob>;

export function createSimQueue(redisUrl: string, nodeEnv: string, prefix?: string): SimQueue {
  return new Queue<SimulatorEnrollJob>(SIMULATOR_QUEUE, {
    prefix: prefix ?? queuePrefix(nodeEnv),
    connection: redisConnection(redisUrl),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1_000 },
      removeOnComplete: 1_000,
      removeOnFail: 5_000,
    },
  });
}
