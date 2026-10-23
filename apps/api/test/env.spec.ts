import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.js';

const valid = {
  DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/db',
  REDIS_URL: 'redis://127.0.0.1:6379',
};

describe('loadEnv', () => {
  it('aceita configuração válida e aplica padrões', () => {
    const env = loadEnv(valid);
    expect(env.API_PORT).toBe(3001);
    expect(env.NODE_ENV).toBe('development');
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
