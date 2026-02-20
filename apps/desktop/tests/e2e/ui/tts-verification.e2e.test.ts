/**
 * TTS Verification E2E Tests
 * Verifies text-to-speech audio generation
 */
import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import { sleep } from '../helpers/waitHelper';
import { startPythonBackend, stopPythonBackend, getBackendUrl } from '../helpers/electronHelper';

let electronApp: ElectronApplication;
let page: Page;

test.describe('TTS Audio Generation', () => {
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

  test('should generate TTS audio for match start message', async () => {
    const response = await fetch(`${getBackendUrl()}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Partida iniciada. Volta 6 minutos.' }),
    });

    expect(response.ok).toBe(true);
    expect(response.headers.get('content-type')).toBe('audio/wav');
    
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
    
    // Verify WAV header
    const header = new Uint8Array(buffer.slice(0, 4));
    const riff = String.fromCharCode(...header);
    expect(riff).toBe('RIFF');
  });

  test('should generate TTS audio for score announcement', async () => {
    const response = await fetch(`${getBackendUrl()}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Placar atual: dois a um.' }),
    });

    expect(response.ok).toBe(true);
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(100);
  });

  test('should generate TTS audio for pause message', async () => {
    const response = await fetch(`${getBackendUrl()}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Partida pausada.' }),
    });

    expect(response.ok).toBe(true);
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(100);
  });

  test('should generate TTS audio for resume message', async () => {
    const response = await fetch(`${getBackendUrl()}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Partida retomada.' }),
    });

    expect(response.ok).toBe(true);
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(100);
  });

  test('should generate TTS audio for doubt registration', async () => {
    const response = await fetch(`${getBackendUrl()}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Dúvida registrada para revisão.' }),
    });

    expect(response.ok).toBe(true);
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(100);
  });

  test('should generate TTS audio for match end message', async () => {
    const response = await fetch(`${getBackendUrl()}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Partida encerrada. Placar final: três a dois.' }),
    });

    expect(response.ok).toBe(true);
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(100);
  });

  test('should generate TTS audio for help commands', async () => {
    const response = await fetch(`${getBackendUrl()}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Comandos disponíveis: Volta 6, Resultado, Intervalo, Dúvida agora, Encerrar.' }),
    });

    expect(response.ok).toBe(true);
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(100);
  });

  test('should return error for empty text', async () => {
    const response = await fetch(`${getBackendUrl()}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '' }),
    });

    expect(response.status).toBe(422);
  });
});
