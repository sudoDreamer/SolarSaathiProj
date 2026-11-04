import tseslint from 'typescript-eslint';
export default tseslint.config(
  {
    ignores: ['node_modules/**', 'dist/**', '.local/**', 'test-results/**', 'playwright-report/**'],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-empty-object-type': 'error',
    },
  },
);
