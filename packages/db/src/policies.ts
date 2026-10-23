import { POLICY_TEMPLATES, type PolicyTemplate } from '@dw/contracts';
import { recordAudit } from './audit.js';
import type { Tx } from './client.js';
import { policies, policyVersions, type Policy } from './policy-schema.js';

/**
 * Garante que a empresa da transação tenha as políticas prontas Vendas e Merchandising (versão 1).
 * Idempotente: chamadas repetidas ou concorrentes não duplicam nada.
 */
export async function ensureDefaultPolicies(
  tx: Tx,
  tenantId: string,
): Promise<Record<PolicyTemplate, Policy>> {
  const existing = await tx.select().from(policies);
  const out = Object.fromEntries(existing.map((p) => [p.template, p])) as Partial<
    Record<PolicyTemplate, Policy>
  >;
  for (const template of Object.keys(POLICY_TEMPLATES) as PolicyTemplate[]) {
    if (out[template]) continue;
    const t = POLICY_TEMPLATES[template];
    const [p] = await tx
      .insert(policies)
      .values({ tenantId, template, name: t.name, description: t.description })
      .onConflictDoNothing()
      .returning();
    if (!p) {
      // Outra transação criou ao mesmo tempo.
      const again = await tx.select().from(policies);
      for (const x of again) out[x.template] = x;
      continue;
    }
    await tx.insert(policyVersions).values({
      tenantId,
      policyId: p.id,
      version: 1,
      settings: t.settings,
      note: 'Modelo pronto do DW Solutions',
      createdBy: 'sistema',
      createdByName: 'DW Solutions',
    });
    await recordAudit(tx, {
      tenantId,
      actorType: 'system',
      actorId: 'sistema',
      action: 'policy.create',
      targetType: 'policy',
      targetId: p.id,
      metadata: { template, version: 1 },
    });
    out[template] = p;
  }
  return out as Record<PolicyTemplate, Policy>;
}
