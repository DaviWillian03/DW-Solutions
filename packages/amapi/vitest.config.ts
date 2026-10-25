import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@dw/contracts': fileURLToPath(new URL('../contracts/src/index.ts', import.meta.url)) },
  },
  test: { include: ['test/**/*.spec.ts'], environment: 'node' },
});
