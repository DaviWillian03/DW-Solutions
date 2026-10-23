import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', 'docs/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Proibido logar com console fora de scripts: usar o logger estruturado.
      'no-console': ['error', { allow: ['error'] }],
    },
  },
  {
    files: ['infrastructure/**', '**/scripts/**'],
    rules: { 'no-console': 'off' },
  },
);
