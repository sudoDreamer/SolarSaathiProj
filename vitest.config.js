import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['tests/**/*.test.js'], pool: 'forks', maxWorkers: 1, minWorkers: 1 },
});
