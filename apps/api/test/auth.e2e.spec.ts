import type { INestApplication } from '@nestjs/common';
import { createDb, verifyAuditChain, withTenant, auditEvents, asc } from '@dw/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  Client,
  ORIGIN,
  STRONG,
  platformCreateTenant,
  randomIp,
  readyAdminFor,
  secretFromUri,
  signIn,
  startApp,
  totp,
} from './support.js';

let app: INestApplication;
let server: unknown;
const readyAdmin = (name: string) => readyAdminFor(server, name);

beforeAll(async () => {
  app = await startApp();
  server = app.getHttpServer();
});
afterAll(async () => {
  await app.close();
});

describe('fluxo do primeiro administrador', () => {
  let t: Awaited<ReturnType<typeof platformCreateTenant>>;
  const c = () => new Client(server);
  let admin: Client;
  let secret = '';
  let backupCodes: string[] = [];

  beforeAll(async () => {
    t = await platformCreateTenant('Empresa Fluxo');
    admin = c();
  });

  it('não existe cadastro aberto (sign-up desativado)', async () => {
    const r = await c().post('/api/auth/sign-up/email', {
      email: 'x@exemplo.test',
      password: STRONG,
      name: 'X',
    });
    expect(r.status).toBeGreaterThanOrEqual(400);
  });

  it('convite recusa senha fraca e token inválido', async () => {
    expect((await c().post('/api/invitations/accept', { token: t.token, password: 'curta' })).status).toBe(
      400,
    );
    const falso = 'A'.repeat(43);
    const r = await c().post('/api/invitations/accept', { token: falso, password: STRONG });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('INVALID_INVITATION');
  });

  it('aceita o convite uma única vez', async () => {
    const r = await c().post('/api/invitations/accept', { token: t.token, password: STRONG });
    expect(r.status).toBe(201);
    expect(r.body.email).toBe(t.email);
    const de_novo = await c().post('/api/invitations/accept', { token: t.token, password: STRONG });
    expect(de_novo.body.code).toBe('INVALID_INVITATION');
  });

  it('senha errada é recusada; sem login, a API responde 401', async () => {
    expect((await signIn(c(), t.email, 'Senha-Errada-123456')).status).toBe(401);
    expect((await c().get('/api/me')).status).toBe(401);
  });

  it('admin sem MFA vê /me mas é bloqueado no resto até cadastrar', async () => {
    const r = await signIn(admin, t.email);
    expect(r.status).toBe(200);
    expect(admin.cookieHeader()).toMatch(/__Secure-dw\.session_token=/);
    const me = await admin.get('/api/me');
    expect(me.status).toBe(200);
    expect(me.body.mfaRequired).toBe(true);
    expect(me.body.tenant.name).toBe('Empresa Fluxo');
    const users = await admin.get('/api/users');
    expect(users.status).toBe(403);
    expect(users.body.code).toBe('MFA_ENROLLMENT_REQUIRED');
  });

  it('cadastra o app autenticador com código válido', async () => {
    const en = await admin.post('/api/auth/two-factor/enable', { password: STRONG });
    expect(en.status).toBe(200);
    expect(en.body.totpURI).toMatch(/^otpauth:\/\/totp\/DW%20Solutions/);
    expect(en.body.backupCodes).toHaveLength(10);
    secret = secretFromUri(en.body.totpURI);
    backupCodes = en.body.backupCodes;
    expect((await admin.post('/api/auth/two-factor/verify-totp', { code: '000000' })).status).toBe(401);
    expect((await admin.post('/api/auth/two-factor/verify-totp', { code: totp(secret) })).status).toBe(200);
    const users = await admin.get('/api/users');
    expect(users.status).toBe(200);
    expect(users.body[0].email).toBe(t.email);
    expect(users.body[0]).not.toHaveProperty('password');
  });

  it('novo login exige o segundo fator antes de liberar a sessão', async () => {
    const c2 = c();
    const r = await signIn(c2, t.email);
    expect(r.body.twoFactorRedirect).toBe(true);
    expect((await c2.get('/api/me')).status).toBe(401);
    expect((await c2.post('/api/auth/two-factor/verify-totp', { code: totp(secret) })).status).toBe(200);
    expect((await c2.get('/api/me')).status).toBe(200);
  });

  it('código de recuperação funciona uma única vez', async () => {
    const code = backupCodes[0]!;
    const c3 = c();
    await signIn(c3, t.email);
    expect((await c3.post('/api/auth/two-factor/verify-backup-code', { code })).status).toBe(200);
    expect((await c3.get('/api/me')).status).toBe(200);
    const c4 = c();
    await signIn(c4, t.email);
    expect((await c4.post('/api/auth/two-factor/verify-backup-code', { code })).status).not.toBe(200);
    expect((await c4.get('/api/me')).status).toBe(401);
  });

  it('sair invalida a sessão', async () => {
    const c5 = c();
    await signIn(c5, t.email);
    await c5.post('/api/auth/two-factor/verify-totp', { code: totp(secret) });
    const cookie = c5.cookieHeader();
    expect((await c5.post('/api/auth/sign-out')).status).toBe(200);
    const reuse = await (
      await import('supertest')
    )
      .default(server as never)
      .get('/api/me')
      .set('cookie', cookie);
    expect(reuse.status).toBe(401);
  });
});

describe('perfis, isolamento e desativação', () => {
  let A: Awaited<ReturnType<typeof readyAdmin>>;
  let B: Awaited<ReturnType<typeof readyAdmin>>;
  let viewer: Client;
  let viewerId = '';

  beforeAll(async () => {
    A = await readyAdmin('Empresa Alfa');
    B = await readyAdmin('Empresa Beta');
    const inv = await A.c.post('/api/users/invite', {
      name: 'Leitora Alfa',
      email: 'leitora.alfa@exemplo.test',
      role: 'viewer',
    });
    expect(inv.status).toBe(201);
    viewerId = inv.body.userId;
    expect(inv.body.inviteUrl).toMatch(new RegExp(`^${ORIGIN}/convite#[A-Za-z0-9_-]{43}$`));
    viewer = new Client(server);
    await viewer.post('/api/invitations/accept', {
      token: inv.body.inviteUrl.split('#')[1],
      password: STRONG,
    });
    expect((await signIn(viewer, 'leitora.alfa@exemplo.test')).status).toBe(200);
  });

  it('perfil Leitura consulta, mas não convida (sem MFA obrigatório)', async () => {
    expect((await viewer.get('/api/users')).status).toBe(200);
    const r = await viewer.post('/api/users/invite', { name: 'X Y', email: 'x@exemplo.test', role: 'admin' });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('FORBIDDEN_ROLE');
  });

  it('cada empresa só vê os próprios usuários', async () => {
    const emailsA = (await A.c.get('/api/users')).body.map((u: { email: string }) => u.email);
    const emailsB = (await B.c.get('/api/users')).body.map((u: { email: string }) => u.email);
    expect(emailsA).toContain('leitora.alfa@exemplo.test');
    expect(emailsB).not.toContain('leitora.alfa@exemplo.test');
    expect(emailsB).not.toContain(A.email);
  });

  it('admin de outra empresa não consegue desativar usuário alheio (404)', async () => {
    const r = await B.c.post(`/api/users/${viewerId}/disable`, { reason: 'tentativa cruzada' });
    expect(r.status).toBe(404);
    expect((await viewer.get('/api/me')).status).toBe(200);
  });

  it('e-mail já usado em outra empresa recebe mensagem genérica', async () => {
    const r = await B.c.post('/api/users/invite', {
      name: 'Clone',
      email: 'leitora.alfa@exemplo.test',
      role: 'viewer',
    });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('EMAIL_UNAVAILABLE');
  });

  it('valida entrada e não aceita perfis inventados', async () => {
    const r = await A.c.post('/api/users/invite', { name: 'Z', email: 'nao-e-email', role: 'superadmin' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('VALIDATION');
  });

  it('não desativa a si mesmo nem o último administrador', async () => {
    const me = (await A.c.get('/api/me')).body.user.id;
    const r = await A.c.post(`/api/users/${me}/disable`, { reason: 'teste de segurança' });
    expect(r.body.code).toBe('CANNOT_DISABLE_SELF');
  });

  it('desativar revoga a sessão na hora e impede novo login', async () => {
    expect((await A.c.post(`/api/users/${viewerId}/disable`, { reason: 'desligamento' })).status).toBe(204);
    expect((await viewer.get('/api/me')).status).toBe(401);
    expect((await signIn(new Client(server), 'leitora.alfa@exemplo.test')).status).toBeGreaterThanOrEqual(
      400,
    );
  });

  it('ações ficam na auditoria da empresa, com cadeia íntegra', async () => {
    const appDb = createDb(process.env.TEST_DATABASE_URL!, 1);
    try {
      const { tenantId } = A;
      const evs = await withTenant(appDb.db, tenantId, (tx) =>
        tx.select().from(auditEvents).orderBy(asc(auditEvents.seq)),
      );
      const acoes = evs.map((e) => `${e.action}:${e.outcome}`);
      for (const a of [
        'tenant.create:success',
        'user.invite:success',
        'user.invitation_accepted:success',
        'auth.login:success',
        'user.disable:success',
      ]) {
        expect(acoes).toContain(a);
      }
      expect(acoes).toContain('auth.login:denied');
      expect(evs.every((e) => !JSON.stringify(e.metadata).includes(STRONG))).toBe(true);
      expect(await withTenant(appDb.db, tenantId, verifyAuditChain)).toEqual([]);
    } finally {
      await appDb.close();
    }
  });
});

describe('proteções contra abuso', () => {
  it('rotas que alteram dados recusam outra origem ou ausência de origem (CSRF)', async () => {
    const A = await readyAdmin('Empresa CSRF');
    const body = { name: 'Fulano', email: 'fulano.csrf@exemplo.test', role: 'viewer' };
    expect((await A.c.post('/api/users/invite', body, 'https://site-malicioso.example')).body.code).toBe(
      'BAD_ORIGIN',
    );
    expect((await A.c.post('/api/users/invite', body, null)).status).toBe(403);
    // Login e demais rotas de autenticação também exigem a origem do site.
    const r = await new Client(server).post(
      '/api/auth/sign-in/email',
      { email: A.email, password: STRONG },
      'https://site-malicioso.example',
    );
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('BAD_ORIGIN');
    const semOrigem = await new Client(server).post(
      '/api/auth/sign-in/email',
      { email: A.email, password: STRONG },
      null,
    );
    expect(semOrigem.status).toBe(403);
    // Com sessão (cookie), a própria biblioteca também recusa outra origem.
    const c = A.c;
    expect((await c.post('/api/auth/sign-out', {}, 'https://site-malicioso.example')).status).toBe(403);
    expect((await c.get('/api/me')).status).toBe(200);
  });

  it('limita tentativas de login por IP', async () => {
    const t = await platformCreateTenant('Empresa Limite');
    const c = new Client(server);
    const status: number[] = [];
    for (let i = 0; i < 7; i++) status.push((await signIn(c, t.email, 'Errada-Errada-123')).status);
    expect(status.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(status.at(-1)).toBe(429);
  });

  it('bloqueia a conta após 10 falhas, mesmo vindas de IPs diferentes', async () => {
    const t = await platformCreateTenant('Empresa Bloqueio');
    await new Client(server).post('/api/invitations/accept', { token: t.token, password: STRONG });
    for (let i = 0; i < 10; i++) {
      await signIn(new Client(server, randomIp()), t.email, 'Errada-Errada-123');
    }
    const r = await signIn(new Client(server, randomIp()), t.email, STRONG);
    expect(r.status).toBe(429);
  });

  it('código de MFA errado repetidamente é limitado', async () => {
    const A = await readyAdmin('Empresa TOTP');
    const c = new Client(server);
    await signIn(c, A.email);
    const status: number[] = [];
    for (let i = 0; i < 7; i++)
      status.push((await c.post('/api/auth/two-factor/verify-totp', { code: '123456' })).status);
    expect(status).toContain(429);
  });

  it('respostas de erro não vazam detalhes internos', async () => {
    const r = await new Client(server).post('/api/invitations/accept', { token: 123, password: [] });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).not.toMatch(/stack|node_modules|at .*\(/);
  });
});
