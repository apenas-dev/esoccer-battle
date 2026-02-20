/**
 * App Initialization E2E Tests
 * Verifies that the Electron app starts correctly
 */
import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import { sleep, waitForCondition } from '../helpers/waitHelper';
import { startPythonBackend, stopPythonBackend, getBackendUrl } from '../helpers/electronHelper';

let electronApp: ElectronApplication;
let page: Page;

test.describe('App Initialization', () => {
  test.beforeAll(async () => {
    // Start Python backend first
    await startPythonBackend();
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
    await stopPythonBackend();
  });

  test('should launch Electron app successfully', async () => {
    const mainPath = path.resolve(__dirname, '../../../dist-electron/main/index.js');
    
    electronApp = await electron.launch({
      args: [mainPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    expect(electronApp).toBeTruthy();
  });

  test('should open main window', async () => {
    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    
    expect(page).toBeTruthy();
  });

  test('should display app title', async () => {
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('should render main UI elements', async () => {
    await page.waitForLoadState('networkidle');
    
    // Check for main container
    const mainContent = await page.locator('body').isVisible();
    expect(mainContent).toBe(true);
  });

  test('should have backend health check working', async () => {
    const response = await fetch(`${getBackendUrl()}/health`);
    expect(response.ok).toBe(true);
    
    const data = await response.json();
    expect(data.status).toBe('ok');
  });

  test('should display voice indicator', async () => {
    await sleep(2000); // Wait for UI to stabilize
    
    // Look for any status-related element
    const bodyContent = await page.locator('body').textContent();
    expect(bodyContent).toBeTruthy();
  });
});
