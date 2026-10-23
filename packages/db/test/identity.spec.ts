import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authSessions, authUsers } from '../src/auth-schema.js';
import { withTenant } from '../src/client.js';
import { app, auth, createTenant, expectPgError, platform } from './helpers.js';

const DENIED = '42501';
const a = app();
const p = platform();
const au = auth();
let tenantA = '';
let tenantB = '';
let userB = '';

const newUser = (tenantId: string, role: 'admin' | 'viewer' = 'viewer') => ({
  id: randomUUID(),
  tenantId,
  name: 'Pessoa Teste',
  email: `${randomUUID().slice(0, 8)}@exemplo.test`,
  role,
});

beforeAll(async () => {
  tenantA = await createTenant(p, 'Empresa A');
  tenantB = await createTenant(p, 'Empresa B');
  await withTenant(a.db, tenantA, (tx) => tx.insert(authUsers).values(newUser(tenantA, 'admin')));
  const ub = newUser(tenantB);
  userB = ub.id;
  await withTenant(a.db, tenantB, (tx) => tx.insert(authUsers).values(ub));
});

afterAll(async () => {
  await Promise.all([a.close(), p.close(), au.close()]);
});

describe('identidade — papel dw_app (usuários da empresa)', () => {
  it('vê só usuários da própria empresa', async () => {
    const vistos = await withTenant(a.db, tenantA, (tx) => tx.select().from(authUsers));
    expect(vistos.every((u) => u.tenantId === tenantA)).toBe(true);
    expect(vistos.find((u) => u.id === userB)).toBeUndefined();
  });

  it('não cria usuário em outra empresa', async () => {
    await expectPgError(
      withTenant(a.db, tenantA, (tx) => tx.insert(authUsers).values(newUser(tenantB))),
      DENIED,
    );
  });

  it('não altera a flag de MFA nem acessa sessões, senhas ou segredos de MFA', async () => {
    await expectPgError(
      withTenant(a.db, tenantA, (tx) => tx.update(authUsers).set({ twoFactorEnabled: false })),
      DENIED,
    );
    for (const t of ['auth_sessions', 'auth_accounts', 'auth_two_factors', 'auth_passkeys']) {
      await expectPgError(
        withTenant(a.db, tenantA, (tx) => tx.execute(sql.raw(`select * from ${t}`))),
        DENIED,
      );
    }
  });
});

describe('identidade — papel dw_auth (biblioteca de login)', () => {
  it('lê qualquer identidade (necessário para login) e gerencia sessões', async () => {
    const [u] = await au.db.select().from(authUsers).where(eq(authUsers.id, userB));
    expect(u?.tenantId).toBe(tenantB);
    await au.db.insert(authSessions).values({
      id: randomUUID(),
      userId: userB,
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 60_000),
    });
  });

  it('não cria usuários nem muda perfil, empresa ou situação (sem escalada de privilégio)', async () => {
    await expectPgError(au.db.insert(authUsers).values(newUser(tenantA, 'admin')), DENIED);
    await expectPgError(
      au.db.update(authUsers).set({ role: 'admin' }).where(eq(authUsers.id, userB)),
      DENIED,
    );
    await expectPgError(
      au.db.update(authUsers).set({ tenantId: tenantA }).where(eq(authUsers.id, userB)),
      DENIED,
    );
    await expectPgError(
      au.db.update(authUsers).set({ status: 'active' }).where(eq(authUsers.id, userB)),
      DENIED,
    );
  });

  it('não acessa dados de aparelhos/responsáveis nem auditoria', async () => {
    await expectPgError(au.db.execute(sql`select * from device_holders`), DENIED);
    await expectPgError(au.db.execute(sql`select * from audit_events`), DENIED);
  });
});

describe('identidade — papel dw_platform', () => {
  it('cria o primeiro administrador, mas não outros perfis', async () => {
    await p.db.insert(authUsers).values(newUser(tenantA, 'admin'));
    await expectPgError(p.db.insert(authUsers).values(newUser(tenantA, 'viewer')), DENIED);
  });

  it('não lê usuários das empresas', async () => {
    await expectPgError(p.db.select().from(authUsers), DENIED);
  });
});

describe('identidade — integridade', () => {
  it('e-mail é único sem diferenciar maiúsculas e precisa estar em minúsculas', async () => {
    const u = newUser(tenantA);
    await withTenant(a.db, tenantA, (tx) => tx.insert(authUsers).values(u));
    await expectPgError(
      withTenant(a.db, tenantA, (tx) => tx.insert(authUsers).values({ ...u, id: randomUUID() })),
      '23505',
    );
    await expectPgError(
      withTenant(a.db, tenantA, (tx) =>
        tx.insert(authUsers).values({ ...newUser(tenantA), email: 'Maiuscula@Exemplo.test' }),
      ),
      '23514',
    );
  });

  it('perfil fora de admin/leitura é recusado', async () => {
    await expectPgError(
      withTenant(a.db, tenantA, (tx) =>
        tx.insert(authUsers).values({ ...newUser(tenantA), role: 'superuser' as 'admin' }),
      ),
      '23514',
    );
  });
});
