import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/e2e/setup.ts'],
    include: ['tests/e2e/backend/**/*.e2e.test.ts'],
    exclude: ['tests/e2e/ui/**/*.e2e.test.ts'],
    testTimeout: 120000, // 2 minutos para downloads de modelos
    hookTimeout: 180000, // 3 minutos para setup/teardown
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Executa testes sequencialmente
      },
    },
  },
});
