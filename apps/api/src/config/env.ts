import { z } from 'zod';

const postgresUrl = z
  .string()
  .url()
  .refine(
    (v) => v.startsWith('postgres://') || v.startsWith('postgresql://'),
    'deve ser uma URL postgres://',
  );

const httpOrigin = z
  .string()
  .url()
  .refine((v) => /^https?:\/\/[^/]+$/.test(v), 'deve ser uma origem http(s)://host[:porta] sem caminho');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Papel dw_app (dados de empresa, sempre com RLS). */
  DATABASE_URL: postgresUrl,
  /** Papel dw_auth (exclusivo da biblioteca de login). */
  AUTH_DATABASE_URL: postgresUrl,
  REDIS_URL: z
    .string()
    .url()
    .refine((v) => v.startsWith('redis://') || v.startsWith('rediss://'), 'deve ser uma URL redis://'),
  /** Origem pública do site (Next.js), que encaminha /api para esta API. */
  WEB_ORIGIN: httpOrigin,
  BETTER_AUTH_URL: httpOrigin,
  BETTER_AUTH_SECRET: z.string().regex(/^[0-9a-f]{64}$/, 'deve ter 32 bytes em hexadecimal'),
  /** Prefixo da fila no Redis (opcional; padrão por NODE_ENV). */
  QUEUE_PREFIX: z
    .string()
    .regex(/^[a-z0-9-]{2,20}$/)
    .optional(),
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
