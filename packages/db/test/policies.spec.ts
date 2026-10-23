import { POLICY_TEMPLATES } from '@dw/contracts';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from '../src/client.js';
import { devices } from '../src/device-schema.js';
import { ensureDefaultPolicies } from '../src/policies.js';
import { policies, policyVersions } from '../src/policy-schema.js';
import { auditEvents } from '../src/schema.js';
import { app, createTenant, expectPgError, platform } from './helpers.js';

const DENIED = '42501';
const FK = '23503';
const CHECK = '23514';
const a = app();
const p = platform();
let tA = '';
let tB = '';
let salesA = '';
let salesB = '';

beforeAll(async () => {
  tA = await createTenant(p, 'Empresa A');
  tB = await createTenant(p, 'Empresa B');
  salesA = (await withTenant(a.db, tA, (tx) => ensureDefaultPolicies(tx, tA))).sales.id;
  salesB = (await withTenant(a.db, tB, (tx) => ensureDefaultPolicies(tx, tB))).sales.id;
});

afterAll(async () => {
  await Promise.all([a.close(), p.close()]);
});

describe('políticas — modelos prontos', () => {
  it('cria Vendas e Merchandising na versão 1, uma única vez, com auditoria', async () => {
    const again = await withTenant(a.db, tA, (tx) => ensureDefaultPolicies(tx, tA));
    expect(again.sales.id).toBe(salesA);
    const rows = await withTenant(a.db, tA, (tx) => tx.select().from(policies));
    expect(rows.map((r) => r.name).sort()).toEqual(['Merchandising', 'Vendas']);
    const versions = await withTenant(a.db, tA, (tx) => tx.select().from(policyVersions));
    expect(versions).toHaveLength(2);
    expect(versions.find((v) => v.policyId === salesA)!.settings).toEqual(POLICY_TEMPLATES.sales.settings);
    const audit = await withTenant(a.db, tA, (tx) =>
      tx.select().from(auditEvents).where(eq(auditEvents.action, 'policy.create')),
    );
    expect(audit).toHaveLength(2);
  });
});

describe('políticas — isolamento e integridade', () => {
  it('cada empresa vê só as próprias políticas e versões', async () => {
    const seen = await withTenant(a.db, tA, (tx) => tx.select().from(policies));
    expect(seen.every((x) => x.tenantId === tA)).toBe(true);
    expect(seen.map((x) => x.id)).not.toContain(salesB);
    expect(await a.db.select().from(policies)).toHaveLength(0);
    expect(await p.db.execute(sql`select 1 from policies`).catch((e) => e)).toBeInstanceOf(Error);
  });

  it('não liga aparelho a política de OUTRA empresa (FK composta)', async () => {
    await expectPgError(
      withTenant(a.db, tA, (tx) =>
        tx.insert(devices).values({
          tenantId: tA,
          displayName: 'Galaxy A25 · Vendas 01',
          manufacturer: 'samsung',
          model: 'Galaxy A25',
          androidVersion: 14,
          policyId: salesB,
          policyVersion: 1,
        }),
      ),
      FK,
    );
  });

  it('política e versão desejada andam juntas', async () => {
    await expectPgError(
      withTenant(a.db, tA, (tx) =>
        tx.insert(devices).values({
          tenantId: tA,
          displayName: 'Galaxy A25 · Vendas 02',
          manufacturer: 'samsung',
          model: 'Galaxy A25',
          androidVersion: 14,
          policyId: salesA,
        }),
      ),
      CHECK,
    );
  });

  it('versões são imutáveis e políticas não podem ser apagadas', async () => {
    await expectPgError(
      withTenant(a.db, tA, (tx) =>
        tx.update(policyVersions).set({ note: 'alterada' }).where(eq(policyVersions.policyId, salesA)),
      ),
      DENIED,
    );
    await expectPgError(
      withTenant(a.db, tA, (tx) => tx.delete(policyVersions).where(eq(policyVersions.policyId, salesA))),
      DENIED,
    );
    await expectPgError(
      withTenant(a.db, tA, (tx) => tx.delete(policies).where(eq(policies.id, salesA))),
      DENIED,
    );
  });

  it('nome e modelo da política não mudam; a versão só avança de 1 em 1', async () => {
    await expectPgError(
      withTenant(a.db, tA, (tx) => tx.update(policies).set({ name: 'Outra' }).where(eq(policies.id, salesA))),
      DENIED,
    );
    await expectPgError(
      withTenant(a.db, tA, (tx) =>
        tx.update(policies).set({ currentVersion: 5 }).where(eq(policies.id, salesA)),
      ),
      CHECK,
    );
    await withTenant(a.db, tA, (tx) =>
      tx.update(policies).set({ currentVersion: 2 }).where(eq(policies.id, salesA)),
    );
    await expectPgError(
      withTenant(a.db, tA, (tx) =>
        tx.update(policies).set({ currentVersion: 1 }).where(eq(policies.id, salesA)),
      ),
      CHECK,
    );
  });

  it('não existem duas versões com o mesmo número', async () => {
    await expectPgError(
      withTenant(a.db, tA, (tx) =>
        tx.insert(policyVersions).values({
          tenantId: tA,
          policyId: salesA,
          version: 1,
          settings: POLICY_TEMPLATES.sales.settings,
          note: 'duplicada',
          createdBy: 'teste',
          createdByName: 'Teste',
        }),
      ),
      '23505',
    );
  });
});
