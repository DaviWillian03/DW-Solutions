import { createHmac, randomInt } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { createDb } from '@dw/db';
import request from 'supertest';
import { type Env, loadEnv } from '../src/config/env.js';
import { createApp } from '../src/main.js';
import { createTenantWithAdmin } from '../src/platform/create-tenant.js';

export const ORIGIN = 'http://localhost:3000';

export const testEnv = (overrides: Partial<Env> = {}): Env => ({
  ...loadEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: process.env.TEST_DATABASE_URL,
    AUTH_DATABASE_URL: process.env.TEST_AUTH_DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    WEB_ORIGIN: ORIGIN,
    BETTER_AUTH_URL: ORIGIN,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  }),
  ...overrides,
});

export async function startApp(overrides: Partial<Env> = {}): Promise<INestApplication> {
  const { app } = await createApp(testEnv(overrides));
  await app.init();
  return app;
}

/** IP aleatório por "cliente" para não esbarrar no limite por IP entre testes diferentes. */
export const randomIp = () => `10.${randomInt(255)}.${randomInt(255)}.${randomInt(1, 255)}`;

/** Cliente HTTP com cookies (como um navegador) e origem do site. */
export class Client {
  private cookies = new Map<string, string>();
  constructor(
    private readonly server: unknown,
    readonly ip = randomIp(),
  ) {}

  private store(res: request.Response) {
    const set = res.headers['set-cookie'] as unknown as string[] | undefined;
    for (const c of set ?? []) {
      const [pair] = c.split(';');
      const i = pair!.indexOf('=');
      const name = pair!.slice(0, i);
      const value = pair!.slice(i + 1);
      if (/max-age=0/i.test(c) || value === '') this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return res;
  }

  cookieHeader() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  async get(path: string) {
    return this.store(
      await request(this.server as never)
        .get(path)
        .set('cookie', this.cookieHeader())
        .set('x-forwarded-for', this.ip),
    );
  }

  async patch(path: string, body: object = {}, origin: string | null = ORIGIN) {
    return this.send('patch', path, body, origin);
  }

  async post(path: string, body: object = {}, origin: string | null = ORIGIN) {
    return this.send('post', path, body, origin);
  }

  private async send(method: 'post' | 'patch', path: string, body: object, origin: string | null) {
    const agent = request(this.server as never);
    let r = (method === 'post' ? agent.post(path) : agent.patch(path))
      .set('cookie', this.cookieHeader())
      .set('x-forwarded-for', this.ip);
    if (origin) r = r.set('origin', origin);
    return this.store(await r.send(body));
  }
}

/** TOTP (RFC 6238, SHA-1, 30 s, 6 dígitos) — implementação independente da biblioteca testada. */
export function totp(base32Secret: string, at = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const ch of base32Secret.replace(/=+$/, '').toUpperCase()) {
    bits += alphabet.indexOf(ch).toString(2).padStart(5, '0');
  }
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const h = createHmac('sha1', key).update(counter).digest();
  const offset = h[h.length - 1]! & 0xf;
  const code = (h.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, '0');
}

export const secretFromUri = (uri: string) => new URL(uri).searchParams.get('secret')!;

/** Cria empresa + 1º admin pela plataforma e devolve o token do convite. */
export async function platformCreateTenant(name: string) {
  const plat = createDb(process.env.TEST_PLATFORM_DATABASE_URL!, 1);
  try {
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${randomInt(1e6)}`;
    const email = `admin.${slug}@exemplo.test`;
    const res = await createTenantWithAdmin(plat, ORIGIN, {
      name,
      slug,
      adminName: `Admin ${name}`,
      adminEmail: email,
    });
    return { ...res, email, token: res.inviteUrl.split('#')[1]! };
  } finally {
    await plat.close();
  }
}

export const STRONG = 'Senha-Forte-de-Teste-2026!';

export async function signIn(c: Client, email: string, password = STRONG) {
  return c.post('/api/auth/sign-in/email', { email, password });
}

/** Admin pronto: convite aceito, login e verificação em duas etapas cadastrada. */
export async function readyAdminFor(server: unknown, name: string) {
  const t = await platformCreateTenant(name);
  const c = new Client(server);
  await c.post('/api/invitations/accept', { token: t.token, password: STRONG });
  await signIn(c, t.email);
  const en = await c.post('/api/auth/two-factor/enable', { password: STRONG });
  const secret = secretFromUri(en.body.totpURI);
  await c.post('/api/auth/two-factor/verify-totp', { code: totp(secret) });
  return { ...t, c, secret, backupCodes: en.body.backupCodes as string[] };
}

/** Convida e loga um usuário de perfil Leitura na empresa do admin. */
export async function viewerOf(server: unknown, admin: Client, email: string) {
  const inv = await admin.post('/api/users/invite', { name: 'Pessoa Leitura', email, role: 'viewer' });
  const c = new Client(server);
  await c.post('/api/invitations/accept', { token: inv.body.inviteUrl.split('#')[1], password: STRONG });
  await signIn(c, email);
  return c;
}

/** Segundo administrador (com MFA) na empresa do admin — para testar aprovação dupla. */
export async function secondAdminOf(server: unknown, admin: Client, email: string) {
  const inv = await admin.post('/api/users/invite', { name: 'Bruno Segundo Admin', email, role: 'admin' });
  const c = new Client(server);
  await c.post('/api/invitations/accept', { token: inv.body.inviteUrl.split('#')[1], password: STRONG });
  await signIn(c, email);
  const en = await c.post('/api/auth/two-factor/enable', { password: STRONG });
  const secret = secretFromUri(en.body.totpURI);
  await c.post('/api/auth/two-factor/verify-totp', { code: totp(secret) });
  return { c, secret };
}

/** Método PUT com cookies e origem (o Client só expõe GET/POST/PATCH). */
export async function put(server: unknown, c: Client, path: string, body: object) {
  return request(server as never)
    .put(path)
    .set('cookie', c.cookieHeader())
    .set('x-forwarded-for', c.ip)
    .set('origin', ORIGIN)
    .send(body);
}
