import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from '../src/client.js';
import { deviceHolders, tenants } from '../src/schema.js';
import { app, createTenant, expectPgError, platform } from './helpers.js';

// 42501 = permissão negada / violação de política RLS
const DENIED = '42501';

const a = app();
const p = platform();
let tenantA = '';
let tenantB = '';
let holderB = '';

beforeAll(async () => {
  tenantA = await createTenant(p, 'Empresa A');
  tenantB = await createTenant(p, 'Empresa B');
  await withTenant(a.db, tenantA, (tx) =>
    tx.insert(deviceHolders).values({ tenantId: tenantA, fullName: 'Ana Vendedora', employeeCode: 'A1' }),
  );
  [{ id: holderB }] = (await withTenant(a.db, tenantB, (tx) =>
    tx
      .insert(deviceHolders)
      .values({ tenantId: tenantB, fullName: 'Bruno Promotor', role: 'merchandising' })
      .returning({ id: deviceHolders.id }),
  )) as [{ id: string }];
});

afterAll(async () => {
  await a.close();
  await p.close();
});

describe('RLS — isolamento entre empresas (papel dw_app)', () => {
  it('sem empresa definida, nada é visível (fail-closed)', async () => {
    expect(await a.db.select().from(deviceHolders)).toHaveLength(0);
    expect(await a.db.select().from(tenants)).toHaveLength(0);
  });

  it('cada empresa vê apenas os próprios responsáveis', async () => {
    const vistosA = await withTenant(a.db, tenantA, (tx) => tx.select().from(deviceHolders));
    expect(vistosA.map((h) => h.fullName)).toEqual(['Ana Vendedora']);
    const vistosB = await withTenant(a.db, tenantB, (tx) => tx.select().from(deviceHolders));
    expect(vistosB.map((h) => h.fullName)).toEqual(['Bruno Promotor']);
  });

  it('buscar o ID de outra empresa (IDOR) não retorna nada', async () => {
    const r = await withTenant(a.db, tenantA, (tx) =>
      tx.select().from(deviceHolders).where(eq(deviceHolders.id, holderB)),
    );
    expect(r).toHaveLength(0);
  });

  it('atualizar registro de outra empresa não altera nada', async () => {
    const r = await withTenant(a.db, tenantA, (tx) =>
      tx.update(deviceHolders).set({ fullName: 'Invadido' }).where(eq(deviceHolders.id, holderB)).returning(),
    );
    expect(r).toHaveLength(0);
    const original = await withTenant(a.db, tenantB, (tx) =>
      tx.select().from(deviceHolders).where(eq(deviceHolders.id, holderB)),
    );
    expect(original[0]!.fullName).toBe('Bruno Promotor');
  });

  it('inserir registro com tenant_id de outra empresa é recusado', async () => {
    await expectPgError(
      withTenant(a.db, tenantA, (tx) =>
        tx.insert(deviceHolders).values({ tenantId: tenantB, fullName: 'Plantado' }),
      ),
      DENIED,
    );
  });

  it('mover um registro para outra empresa é recusado', async () => {
    await expectPgError(
      withTenant(a.db, tenantA, (tx) =>
        tx.update(deviceHolders).set({ tenantId: tenantB }).where(eq(deviceHolders.tenantId, tenantA)),
      ),
      DENIED,
    );
  });

  it('a aplicação não pode apagar responsáveis (exclusão segura por status)', async () => {
    await expectPgError(
      withTenant(a.db, tenantA, (tx) => tx.delete(deviceHolders).where(eq(deviceHolders.tenantId, tenantA))),
      DENIED,
    );
  });

  it('a aplicação vê só a própria empresa na tabela de empresas e não pode criar empresas', async () => {
    const r = await withTenant(a.db, tenantA, (tx) => tx.select().from(tenants));
    expect(r.map((t) => t.id)).toEqual([tenantA]);
    await expectPgError(a.db.insert(tenants).values({ name: 'Pirata', slug: 'pirata' }), DENIED);
  });

  it('a aplicação não consegue desligar o RLS nem alterar tabelas', async () => {
    await expectPgError(a.db.execute(sql`alter table device_holders disable row level security`), DENIED);
    await expectPgError(a.db.execute(sql`set role dw_migrator`), DENIED);
  });

  it('empresa inválida na transação é recusada antes de chegar ao banco', async () => {
    await expect(withTenant(a.db, "x' or '1'='1", async () => 1)).rejects.toThrow(/tenantId inválido/);
  });

  it('a configuração de empresa não vaza para a próxima transação da mesma conexão', async () => {
    const single = app();
    try {
      await withTenant(single.db, tenantA, (tx) => tx.select().from(deviceHolders));
      expect(await single.db.select().from(deviceHolders)).toHaveLength(0);
    } finally {
      await single.close();
    }
  });
});

describe('Plataforma (papel dw_platform) — ADR-0005', () => {
  it('pode criar e listar empresas', async () => {
    const id = await createTenant(p, 'Nova Empresa');
    const todas = await p.db.select({ id: tenants.id }).from(tenants);
    expect(todas.map((t) => t.id)).toContain(id);
  });

  it('nunca lê dados de clientes', async () => {
    await expectPgError(p.db.select().from(deviceHolders), DENIED);
    await expectPgError(p.db.execute(sql`select * from audit_events`), DENIED);
  });
});
