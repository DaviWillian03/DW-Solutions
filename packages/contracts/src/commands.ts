// Comandos remotos (prompt-mestre §5.7, CP4-2/CP4-6). Estados separam o que o PROVEDOR aceitou do que o
// APARELHO confirmou: nada aparece como concluído sem “aplicação verificada”.
import { z } from 'zod';

export const COMMAND_TYPES = [
  'lock',
  'reboot',
  'start_lost_mode',
  'stop_lost_mode',
  'clear_app_data',
  'wipe',
] as const;
export type CommandType = (typeof COMMAND_TYPES)[number];

export const COMMAND_STATES = [
  'requested',
  'validated',
  'waiting_approval',
  'queued',
  'sent_to_provider',
  'provider_accepted',
  'device_acknowledged',
  'applied_verified',
  'failed',
  'expired',
  'cancelled',
  'unknown',
] as const;
export type CommandState = (typeof COMMAND_STATES)[number];

export const FINAL_STATES: readonly CommandState[] = ['applied_verified', 'failed', 'expired', 'cancelled'];
/** Estados em que o aparelho ainda não recebeu o comando — só aqui cancelar tem efeito garantido. */
export const CANCELLABLE_STATES: readonly CommandState[] = [
  'waiting_approval',
  'queued',
  'sent_to_provider',
  'provider_accepted',
];
/** Estados “pendentes”: o comando ainda pode avançar. */
export const PENDING_STATES: readonly CommandState[] = [
  'waiting_approval',
  'queued',
  'sent_to_provider',
  'provider_accepted',
  'device_acknowledged',
];

export const COMMAND_LABEL: Record<CommandType, string> = {
  lock: 'Bloquear tela',
  reboot: 'Reiniciar',
  start_lost_mode: 'Ativar modo perdido',
  stop_lost_mode: 'Desativar modo perdido',
  clear_app_data: 'Limpar dados de app',
  wipe: 'Apagar aparelho',
};

export const COMMAND_STATE_LABEL: Record<CommandState, string> = {
  requested: 'Solicitado',
  validated: 'Validado',
  waiting_approval: 'Aguardando aprovação',
  queued: 'Na fila',
  sent_to_provider: 'Enviado ao provedor',
  provider_accepted: 'Confirmado pelo provedor — aguardando aparelho',
  device_acknowledged: 'Recebido pelo aparelho',
  applied_verified: 'Aplicação verificada',
  failed: 'Falhou',
  expired: 'Expirou',
  cancelled: 'Cancelado',
  unknown: 'Desconhecido',
};

/** Validade padrão: depois disso o comando expira se o aparelho não o recebeu. */
export const COMMAND_TTL_HOURS: Record<CommandType, number> = {
  lock: 24,
  reboot: 24,
  start_lost_mode: 7 * 24,
  stop_lost_mode: 7 * 24,
  clear_app_data: 72,
  wipe: 30 * 24,
};

/** Comandos que exigem justificativa e confirmação digitando o nome do aparelho (CP4). */
export const REQUIRES_REASON: readonly CommandType[] = ['start_lost_mode', 'clear_app_data', 'wipe'];
/** Tipos permitidos em lote (vários aparelhos). Wipe em lote exige um 2º administrador (CP4-6). */
export const BATCH_TYPES = ['lock', 'reboot', 'wipe'] as const;
export type BatchType = (typeof BATCH_TYPES)[number];
export const MAX_BATCH = 500;
export const APPROVAL_TTL_HOURS = 24;

const packageName = z
  .string()
  .trim()
  .max(150)
  .regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, 'Nome de pacote Android inválido.');

export const commandParamsSchema = {
  lock: z.object({}).strict(),
  reboot: z.object({}).strict(),
  start_lost_mode: z
    .object({
      message: z.string().trim().min(3).max(200),
      phone: z
        .string()
        .trim()
        .regex(/^[0-9 ()+-]{8,20}$/, 'Telefone inválido.')
        .optional(),
    })
    .strict(),
  stop_lost_mode: z.object({}).strict(),
  clear_app_data: z.object({ packageNames: z.array(packageName).min(1).max(5) }).strict(),
  wipe: z.object({}).strict(),
} satisfies Record<CommandType, z.ZodType>;

export type CommandParams = {
  [K in CommandType]: z.infer<(typeof commandParamsSchema)[K]>;
};
