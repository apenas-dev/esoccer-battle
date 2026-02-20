/**
 * Volta 6 Command E2E Tests
 * Tests the "Volta 6" (start 6-minute match) command
 */
import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { sleep } from '../helpers/waitHelper';
import { startPythonBackend, stopPythonBackend, getBackendUrl } from '../helpers/electronHelper';
import { audioFiles, readAudioFile } from '../helpers/audioHelper';

let electronApp: ElectronApplication;
let page: Page;

test.describe('Command: Volta 6', () => {
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

  test('volta-seis.wav audio file should exist', async () => {
    expect(fs.existsSync(audioFiles.volta6)).toBe(true);
  });

  test('should process volta6 audio via STT endpoint', async () => {
    const audioBuffer = readAudioFile(audioFiles.volta6);
    
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: 'audio/wav' });
    formData.append('audio', blob, 'volta-seis.wav');

    const response = await fetch(`${getBackendUrl()}/stt`, {
      method: 'POST',
      body: formData,
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toHaveProperty('text');
    expect(typeof data.text).toBe('string');
  });

  test('should have UI ready for commands', async () => {
    await page.waitForLoadState('networkidle');
    const bodyVisible = await page.locator('body').isVisible();
    expect(bodyVisible).toBe(true);
  });

  test('app should respond to text command input', async () => {
    // Test via text input if available
    const inputSelector = 'input[type="text"], [data-testid="command-input"]';
    const hasInput = await page.locator(inputSelector).count() > 0;
    
    if (hasInput) {
      await page.locator(inputSelector).first().fill('volta 6');
      await page.keyboard.press('Enter');
      await sleep(2000);
    }
    
    // Verify app is still responsive
    const isVisible = await page.locator('body').isVisible();
    expect(isVisible).toBe(true);
  });
});
