import { defineConfig } from 'drizzle-kit';

// Só gera SQL a partir do esquema; políticas RLS, permissões e gatilhos ficam em migrações SQL próprias.
export default defineConfig({
  dialect: 'postgresql',
  schema: [
    './src/schema.ts',
    './src/auth-schema.ts',
    './src/device-schema.ts',
    './src/policy-schema.ts',
    './src/command-schema.ts',
  ],
  out: './migrations',
  casing: 'snake_case',
});
