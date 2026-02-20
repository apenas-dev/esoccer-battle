import { defineConfig } from '@playwright/test';
import path from 'path';

/**
 * Playwright configuration for Electron E2E tests
 * E-Soccer Battle Volta 6 Minutos
 */
export default defineConfig({
  testDir: './tests/e2e/ui',
  testMatch: '**/*.e2e.test.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }]
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  timeout: 120000, // 2 minutes for audio processing tests
  expect: {
    timeout: 30000, // 30 seconds for assertions
  },
  outputDir: './tests/e2e/test-results',
  projects: [
    {
      name: 'electron',
      testDir: './tests/e2e/ui',
    },
  ],
});
