import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.js';
import { createApp } from '../src/main.js';

const baseEnv = () =>
  loadEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: process.env.TEST_DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
  });

let app: INestApplication | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function start(overrides: Partial<ReturnType<typeof baseEnv>> = {}) {
  ({ app } = await createApp({ ...baseEnv(), ...overrides }));
  await app.init();
  return app.getHttpServer();
}

describe('GET /health', () => {
  it('responde 200 quando PostgreSQL e Redis estão disponíveis', async () => {
    const res = await request(await start())
      .get('/health')
      .expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.checks.database.status).toBe('up');
    expect(res.body.checks.redis.status).toBe('up');
    expect(Date.parse(res.body.checkedAt)).not.toBeNaN();
  });

  it('responde 503 e marca o Redis como indisponível, sem vazar detalhes do erro', async () => {
    const res = await request(await start({ REDIS_URL: 'redis://127.0.0.1:6390' }))
      .get('/health')
      .expect(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.redis.status).toBe('down');
    expect(res.body.checks.database.status).toBe('up');
    expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|stack|6390/);
  });

  it('responde 503 quando o banco recusa a senha', async () => {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    url.password = 'senha-errada';
    const res = await request(await start({ DATABASE_URL: url.toString() }))
      .get('/health')
      .expect(503);
    expect(res.body.checks.database.status).toBe('down');
    expect(JSON.stringify(res.body)).not.toContain('senha-errada');
  });

  it('devolve um x-request-id e só reaproveita IDs recebidos com formato seguro', async () => {
    const server = await start();
    const gerado = await request(server).get('/health');
    expect(gerado.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);

    const aceito = await request(server).get('/health').set('x-request-id', 'abc12345-ok');
    expect(aceito.headers['x-request-id']).toBe('abc12345-ok');

    for (const ruim of ['<script>alert(1)</script>', 'id com espaço; DROP TABLE x', 'a'.repeat(200)]) {
      const res = await request(server).get('/health').set('x-request-id', ruim);
      expect(res.headers['x-request-id']).not.toBe(ruim);
      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it('não anuncia o framework no cabeçalho', async () => {
    const res = await request(await start()).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
