import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const envFile = fileURLToPath(new URL('../../.env.local', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

// No container do Claude Code o Chromium já vem instalado; na CI usa o do Playwright.
const localChromium = '/opt/pw-browsers/chromium';
const executablePath = process.env.PW_CHROMIUM ?? (existsSync(localChromium) ? localChromium : undefined);

// E2E usa o banco de TESTE (dw_test), recriado no globalSetup.
const apiEnv = {
  NODE_ENV: 'production',
  LOG_LEVEL: 'warn',
  API_PORT: '3001',
  DATABASE_URL: process.env.TEST_DATABASE_URL!,
  AUTH_DATABASE_URL: process.env.TEST_AUTH_DATABASE_URL!,
  REDIS_URL: process.env.REDIS_URL!,
  WEB_ORIGIN: 'http://localhost:3000',
  BETTER_AUTH_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET!,
  QUEUE_PREFIX: 'dw-e2e',
};

const workerEnv = {
  NODE_ENV: 'production',
  LOG_LEVEL: 'info',
  DATABASE_URL: process.env.TEST_DATABASE_URL!,
  PLATFORM_DATABASE_URL: process.env.TEST_PLATFORM_DATABASE_URL!,
  REDIS_URL: process.env.REDIS_URL!,
  QUEUE_PREFIX: 'dw-e2e',
  SIM_ENROLL_DELAY_MS: '800',
  SIM_TICK_SECONDS: '3600',
  // Comandos: aparelho alcançável comunica logo após o aceite; provedor simulado sem falhas aleatórias.
  SIM_PUSH_DELAY_MS: '500',
  SIM_PROVIDER_FAILURE_RATE: '0',
};

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: { executablePath } } }],
  webServer: [
    {
      command: 'node ../api/dist/main.js',
      url: 'http://127.0.0.1:3001/health',
      env: apiEnv,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'node ../worker/dist/main.js',
      env: workerEnv,
      reuseExistingServer: false,
      // O worker não tem HTTP; o Playwright só garante que ele foi iniciado.
      wait: { stdout: /worker do simulador iniciado/ },
      timeout: 60_000,
    },
    {
      command: 'pnpm start',
      url: 'http://localhost:3000/entrar',
      env: { NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
