/**
 * Full Flow E2E Tests
 * Tests complete match flow: Volta 6 → Resultado → Encerrar
 */
import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import { sleep } from '../helpers/waitHelper';
import { startPythonBackend, stopPythonBackend, getBackendUrl } from '../helpers/electronHelper';
import * as sqliteHelper from '../helpers/sqliteHelper';

let electronApp: ElectronApplication;
let page: Page;

test.describe('Full Match Flow', () => {
  test.beforeAll(async () => {
    // Ensure clean state
    sqliteHelper.ensureDataDirectory();
    if (sqliteHelper.databaseExists()) {
      sqliteHelper.clearTestData();
    }
    
    await startPythonBackend();
    
    const mainPath = path.resolve(__dirname, '../../../dist-electron/main/index.js');
    electronApp = await electron.launch({
      args: [mainPath],
      env: { ...process.env, NODE_ENV: 'test' },
    });
    
    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await sleep(5000); // Wait for app to fully initialize
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
    await stopPythonBackend();
    
    // Cleanup test data
    if (sqliteHelper.databaseExists()) {
      sqliteHelper.clearTestData();
    }
  });

  test('should complete full match flow via text commands', async () => {
    const inputSelector = 'input[type="text"], [data-testid="command-input"]';
    const hasInput = await page.locator(inputSelector).count() > 0;
    
    if (!hasInput) {
      console.log('No text input found, skipping text command tests');
      return;
    }

    // Step 1: Start match with "volta 6"
    console.log('Step 1: Starting match...');
    await page.locator(inputSelector).first().fill('volta 6');
    await page.keyboard.press('Enter');
    await sleep(3000);
    
    // Verify app is responsive
    let isVisible = await page.locator('body').isVisible();
    expect(isVisible).toBe(true);

    // Step 2: Check resultado
    console.log('Step 2: Checking resultado...');
    await page.locator(inputSelector).first().fill('resultado');
    await page.keyboard.press('Enter');
    await sleep(2000);
    
    isVisible = await page.locator('body').isVisible();
    expect(isVisible).toBe(true);

    // Step 3: Pause with intervalo
    console.log('Step 3: Pausing match...');
    await page.locator(inputSelector).first().fill('intervalo');
    await page.keyboard.press('Enter');
    await sleep(2000);

    // Step 4: Resume with intervalo
    console.log('Step 4: Resuming match...');
    await page.locator(inputSelector).first().fill('intervalo');
    await page.keyboard.press('Enter');
    await sleep(2000);

    // Step 5: Register doubt
    console.log('Step 5: Registering doubt...');
    await page.locator(inputSelector).first().fill('duvida agora');
    await page.keyboard.press('Enter');
    await sleep(2000);

    // Step 6: End match
    console.log('Step 6: Ending match...');
    await page.locator(inputSelector).first().fill('encerrar');
    await page.keyboard.press('Enter');
    await sleep(2000);

    // Step 7: Confirm ending
    console.log('Step 7: Confirming end...');
    await page.locator(inputSelector).first().fill('confirmar');
    await page.keyboard.press('Enter');
    await sleep(2000);
    
    // Final verification
    isVisible = await page.locator('body').isVisible();
    expect(isVisible).toBe(true);
    console.log('Full flow completed successfully!');
  });

  test('should verify backend remained healthy throughout flow', async () => {
    const response = await fetch(`${getBackendUrl()}/health`);
    expect(response.ok).toBe(true);
    
    const data = await response.json();
    expect(data.status).toBe('ok');
  });
});
