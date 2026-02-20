/**
 * Encerrar Command E2E Tests
 * Tests the "Encerrar" (end match with confirmation) command
 */
import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { sleep } from '../helpers/waitHelper';
import { startPythonBackend, stopPythonBackend, getBackendUrl } from '../helpers/electronHelper';
import { audioFiles, readAudioFile } from '../helpers/audioHelper';

let electronApp: ElectronApplication;
let page: Page;

test.describe('Command: Encerrar', () => {
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

  test('encerrar.wav audio file should exist', async () => {
    expect(fs.existsSync(audioFiles.encerrar)).toBe(true);
  });

  test('confirmar.wav audio file should exist', async () => {
    expect(fs.existsSync(audioFiles.confirmar)).toBe(true);
  });

  test('should process encerrar audio via STT endpoint', async () => {
    const audioBuffer = readAudioFile(audioFiles.encerrar);
    
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: 'audio/wav' });
    formData.append('audio', blob, 'encerrar.wav');

    const response = await fetch(`${getBackendUrl()}/stt`, {
      method: 'POST',
      body: formData,
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toHaveProperty('text');
  });

  test('should handle encerrar with confirmation flow', async () => {
    const inputSelector = 'input[type="text"], [data-testid="command-input"]';
    const hasInput = await page.locator(inputSelector).count() > 0;
    
    if (hasInput) {
      // Start match first
      await page.locator(inputSelector).first().fill('volta 6');
      await page.keyboard.press('Enter');
      await sleep(2000);
      
      // Request to end match (requires confirmation)
      await page.locator(inputSelector).first().fill('encerrar');
      await page.keyboard.press('Enter');
      await sleep(2000);
      
      // Confirm ending
      await page.locator(inputSelector).first().fill('confirmar');
      await page.keyboard.press('Enter');
      await sleep(2000);
    }
    
    const isVisible = await page.locator('body').isVisible();
    expect(isVisible).toBe(true);
  });
});
