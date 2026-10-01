import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'threads',
    include: ['packages/*/tests/**/*.test.{ts,tsx}', 'apps/*/tests/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}']
  }
});
