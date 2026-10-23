import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { recordAudit, redact, verifyAuditChain } from '../src/audit.js';
import { withTenant } from '../src/client.js';
import { auditEvents } from '../src/schema.js';
import { app, createTenant, expectPgError, migrator, platform } from './helpers.js';

const a = app();
const p = platform();
const m = migrator();
let tenant = '';
let other = '';

beforeAll(async () => {
  tenant = await createTenant(p, 'Empresa Auditoria');
  other = await createTenant(p, 'Outra Empresa');
});

afterAll(async () => {
  await a.close();
  await p.close();
  await m.close();
});

const events = () => withTenant(a.db, tenant, (tx) => tx.select().from(auditEvents).orderBy(auditEvents.seq));

describe('auditoria append-only com cadeia de hash', () => {
  it('numera, encadeia e define o horário no banco', async () => {
    await withTenant(a.db, tenant, async (tx) => {
      await recordAudit(tx, { tenantId: tenant, actorType: 'user', actorId: 'u1', action: 'holder.create' });
      await recordAudit(tx, { tenantId: tenant, actorType: 'user', actorId: 'u1', action: 'holder.update' });
    });
    const evs = await events();
    expect(evs.map((e) => e.seq)).toEqual([1, 2]);
    expect(evs[0]!.prevHash).toBe('0'.repeat(64));
    expect(evs[1]!.prevHash).toBe(evs[0]!.hash);
    expect(evs[0]!.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await withTenant(a.db, tenant, verifyAuditChain)).toEqual([]);
  });

  it('a plataforma registra na auditoria da empresa, mas não consegue ler', async () => {
    await p.db.transaction((tx) =>
      recordAudit(tx, {
        tenantId: tenant,
        actorType: 'platform',
        actorId: 'plataforma',
        action: 'tenant.suspend',
      }),
    );
    const evs = await events();
    expect(evs.at(-1)!.action).toBe('tenant.suspend');
    expect(evs.at(-1)!.actorType).toBe('platform');
  });

  it('a aplicação não pode se passar pela plataforma nem gravar em outra empresa', async () => {
    await expectPgError(
      withTenant(a.db, tenant, (tx) =>
        recordAudit(tx, { tenantId: tenant, actorType: 'platform', action: 'x' }),
      ),
      '42501',
    );
    await expectPgError(
      withTenant(a.db, tenant, (tx) => recordAudit(tx, { tenantId: other, actorType: 'user', action: 'x' })),
      '42501',
    );
  });

  it('não é possível alterar nem apagar eventos', async () => {
    await expectPgError(
      withTenant(a.db, tenant, (tx) => tx.execute(sql`update audit_events set action = 'apagado'`)),
      '42501',
    );
    await expectPgError(
      withTenant(a.db, tenant, (tx) => tx.execute(sql`delete from audit_events`)),
      '42501',
    );
  });

  it('segredos em metadados são redigidos antes de gravar', async () => {
    expect(redact({ password: 'x', nested: { token: 'y', ok: 1 }, list: [{ otpCode: '123' }] })).toEqual({
      password: '[redigido]',
      nested: { token: '[redigido]', ok: 1 },
      list: [{ otpCode: '[redigido]' }],
    });
  });

  it('inserções concorrentes mantêm a cadeia íntegra e sem buracos', async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        withTenant(a.db, tenant, (tx) =>
          recordAudit(tx, { tenantId: tenant, actorType: 'system', action: `concorrente.${i}` }),
        ),
      ),
    );
    const evs = await events();
    expect(evs.map((e) => e.seq)).toEqual(evs.map((_, i) => i + 1));
    expect(await withTenant(a.db, tenant, verifyAuditChain)).toEqual([]);
  });

  it('adulteração direta no banco é detectada pela verificação', async () => {
    // Simula um atacante com acesso de dono da tabela (dw_migrator) que desliga as proteções.
    await m.db.transaction(async (tx) => {
      await tx.execute(sql`alter table audit_events no force row level security`);
      await tx.execute(sql`alter table audit_events disable trigger audit_events_no_update_delete`);
      await tx.execute(
        sql`update audit_events set reason = 'alterado' where tenant_id = ${tenant} and seq = 2`,
      );
      await tx.execute(
        sql`delete from audit_events where tenant_id = ${tenant} and seq = (select max(seq) from audit_events where tenant_id = ${tenant})`,
      );
      await tx.execute(sql`alter table audit_events enable trigger audit_events_no_update_delete`);
      await tx.execute(sql`alter table audit_events force row level security`);
    });
    const problems = await withTenant(a.db, tenant, verifyAuditChain);
    expect(problems.some((x) => x.seq === 2 && /hash inválido/.test(x.problem))).toBe(true);
    expect(problems.some((x) => /eventos finais removidos/.test(x.problem))).toBe(true);
  });

  it('verificar sem empresa definida é recusado', async () => {
    await expectPgError(a.db.execute(sql`select * from audit_verify_chain()`), '42501');
  });
});
