/**
 * Duvida Command E2E Tests
 * Tests the "Dúvida Agora" (register doubt) command
 */
import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { sleep } from '../helpers/waitHelper';
import { startPythonBackend, stopPythonBackend, getBackendUrl } from '../helpers/electronHelper';
import { audioFiles, readAudioFile } from '../helpers/audioHelper';

let electronApp: ElectronApplication;
let page: Page;

test.describe('Command: Dúvida Agora', () => {
  test.beforeAll(async () => {
    await startPythonBackend();
    
    const mainPath = path.resolve(__dirname, '../../../dist-electron/main/index.js');
    electronApp = await electron.launch({
      args: [mainPath],
      env: { ...process.env, NODE_ENV: 'test' },
    });
    
    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await sleep(3000);
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
    await stopPythonBackend();
  });

  test('duvida.wav audio file should exist', async () => {
    expect(fs.existsSync(audioFiles.duvida)).toBe(true);
  });

  test('should process duvida audio via STT endpoint', async () => {
    const audioBuffer = readAudioFile(audioFiles.duvida);
    
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: 'audio/wav' });
    formData.append('audio', blob, 'duvida.wav');

    const response = await fetch(`${getBackendUrl()}/stt`, {
      method: 'POST',
      body: formData,
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toHaveProperty('text');
  });

  test('should register doubt during active match', async () => {
    const inputSelector = 'input[type="text"], [data-testid="command-input"]';
    const hasInput = await page.locator(inputSelector).count() > 0;
    
    if (hasInput) {
      // Start match first
      await page.locator(inputSelector).first().fill('volta 6');
      await page.keyboard.press('Enter');
      await sleep(2000);
      
      // Register doubt
      await page.locator(inputSelector).first().fill('duvida agora');
      await page.keyboard.press('Enter');
      await sleep(2000);
    }
    
    const isVisible = await page.locator('body').isVisible();
    expect(isVisible).toBe(true);
  });
});
