import { z } from 'zod';

const postgresUrl = z
  .string()
  .url()
  .refine(
    (v) => v.startsWith('postgres://') || v.startsWith('postgresql://'),
    'deve ser uma URL postgres://',
  );

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: postgresUrl,
  REDIS_URL: z
    .string()
    .url()
    .refine((v) => v.startsWith('redis://') || v.startsWith('rediss://'), 'deve ser uma URL redis://'),
});

export type Env = z.infer<typeof envSchema>;

/** Valida as variáveis de ambiente e falha cedo, sem expor valores secretos na mensagem. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const campos = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Configuração inválida — ${campos}`);
  }
  return parsed.data;
}

export const ENV = Symbol('ENV');
