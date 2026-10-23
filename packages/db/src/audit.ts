import { sql } from 'drizzle-orm';
import type { Tx } from './client.js';
import { auditEvents } from './schema.js';

export interface AuditInput {
  tenantId: string;
  actorType: 'user' | 'platform' | 'system';
  actorId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  outcome?: 'success' | 'denied' | 'failure';
  reason?: string | null;
  metadata?: Record<string, unknown>;
  requestId?: string | null;
  sourceIp?: string | null;
}

// Nunca gravar segredos na auditoria (prompt-mestre §5.9): chaves com estes nomes são redigidas.
const SENSITIVE = /pass(word)?|senha|secret|token|otp|code|key|cookie/i;

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SENSITIVE.test(k) ? '[redigido]' : redact(v),
      ]),
    );
  }
  return value;
}

/** Registra um evento. seq, horário e hashes são definidos pelo banco (gatilho). */
export async function recordAudit(tx: Tx, input: AuditInput): Promise<void> {
  await tx.insert(auditEvents).values({
    tenantId: input.tenantId,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    action: input.action,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    outcome: input.outcome ?? 'success',
    reason: input.reason ?? null,
    metadata: (redact(input.metadata ?? {}) as Record<string, unknown>) ?? {},
    requestId: input.requestId ?? null,
    sourceIp: input.sourceIp ?? null,
    // Placeholders: o gatilho audit_events_chain sobrescreve.
    seq: 0,
    prevHash: '',
    hash: '',
  });
}

export interface ChainProblem {
  seq: number;
  problem: string;
}

/** Verifica a cadeia de auditoria da empresa da transação (requer withTenant). */
export async function verifyAuditChain(tx: Tx): Promise<ChainProblem[]> {
  const res = await tx.execute<{ seq: string; problem: string }>(sql`select * from audit_verify_chain()`);
  return res.rows.map((r) => ({ seq: Number(r.seq), problem: r.problem }));
}
