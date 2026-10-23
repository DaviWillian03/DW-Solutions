import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.js';

const valid = {
  DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/db',
  AUTH_DATABASE_URL: 'postgres://a:p@127.0.0.1:5432/db',
  REDIS_URL: 'redis://127.0.0.1:6379',
  WEB_ORIGIN: 'http://localhost:3000',
  BETTER_AUTH_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 'a'.repeat(64),
};

describe('loadEnv', () => {
  it('aceita configuração válida e aplica padrões', () => {
    const env = loadEnv(valid);
    expect(env.API_PORT).toBe(3001);
    expect(env.NODE_ENV).toBe('development');
  });

  it('recusa segredo de sessão fraco e origem com caminho', () => {
    expect(() => loadEnv({ ...valid, BETTER_AUTH_SECRET: 'curto' })).toThrow(/BETTER_AUTH_SECRET/);
    expect(() => loadEnv({ ...valid, WEB_ORIGIN: 'http://localhost:3000/x' })).toThrow(/WEB_ORIGIN/);
  });

  it('falha cedo quando falta o banco', () => {
    expect(() => loadEnv({ REDIS_URL: valid.REDIS_URL })).toThrow(/DATABASE_URL/);
  });

  it('não expõe a senha na mensagem de erro', () => {
    const segredo = 'senha-super-secreta';
    try {
      loadEnv({ ...valid, DATABASE_URL: `mysql://u:${segredo}@x/db` });
      expect.unreachable();
    } catch (err) {
      expect((err as Error).message).not.toContain(segredo);
    }
  });
});
