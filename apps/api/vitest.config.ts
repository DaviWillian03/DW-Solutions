import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Em desenvolvimento, carrega as variáveis geradas pelo setup; na CI elas vêm do ambiente.
const envFile = fileURLToPath(new URL('../../.env.local', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default defineConfig({
  // SWC preserva os metadados de decorators que a injeção de dependência do NestJS precisa.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/**/*.spec.ts'],
    environment: 'node',
    testTimeout: 15_000,
  },
});
