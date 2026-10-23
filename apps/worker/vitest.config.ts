import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const envFile = fileURLToPath(new URL('../../.env.local', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const src = (p: string) => fileURLToPath(new URL(`../../packages/${p}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: { '@dw/db': src('db'), '@dw/contracts': src('contracts'), '@dw/simulator': src('simulator') },
  },
  test: {
    include: ['test/**/*.spec.ts'],
    environment: 'node',
    fileParallelism: false,
    globalSetup: ['test/global-setup.ts'],
    testTimeout: 30_000,
  },
});
