/**
 * Electron Helper for E2E Tests
 * Provides functions to start/stop Electron app for testing
 */
import { _electron as electron, ElectronApplication, Page } from 'playwright';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let electronApp: ElectronApplication | null = null;
let pythonBackend: ChildProcess | null = null;

const BACKEND_PORT = 8001;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;

/**
 * Start the Python backend server
 */
export async function startPythonBackend(): Promise<void> {
  if (pythonBackend) {
    console.log('Python backend already running');
    return;
  }

  const voiceEnginePath = path.resolve(__dirname, '../../../../backend/voice-engine');
  
  pythonBackend = spawn('python', ['-m', 'esoccer_voice.api.main'], {
    cwd: voiceEnginePath,
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  pythonBackend.stdout?.on('data', (data) => {
    console.log(`[Python Backend]: ${data}`);
  });

  pythonBackend.stderr?.on('data', (data) => {
    console.error(`[Python Backend Error]: ${data}`);
  });

  // Wait for backend to be ready
  await waitForBackendReady(60000);
  console.log('Python backend started successfully');
}

/**
 * Wait for backend health check to pass
 */
export async function waitForBackendReady(timeoutMs: number = 30000): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(`${BACKEND_URL}/health`);
      if (response.ok) {
        return;
      }
    } catch (error) {
      // Backend not ready yet
    }
    await sleep(500);
  }
  
  throw new Error(`Backend failed to start within ${timeoutMs}ms`);
}

/**
 * Stop the Python backend server
 */
export async function stopPythonBackend(): Promise<void> {
  if (pythonBackend) {
    pythonBackend.kill('SIGTERM');
    pythonBackend = null;
    console.log('Python backend stopped');
  }
}

/**
 * Start the Electron application
 */
export async function startElectronApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const distElectronPath = path.resolve(__dirname, '../../../dist-electron/main/index.js');
  
  // First build the app if needed
  console.log('Starting Electron app...');
  
  electronApp = await electron.launch({
    args: [distElectronPath],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
  });

  const page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  
  console.log('Electron app started successfully');
  return { app: electronApp, page };
}

/**
 * Stop the Electron application
 */
export async function stopElectronApp(): Promise<void> {
  if (electronApp) {
    await electronApp.close();
    electronApp = null;
    console.log('Electron app stopped');
  }
}

/**
 * Get the current Electron app instance
 */
export function getElectronApp(): ElectronApplication | null {
  return electronApp;
}

/**
 * Get backend URL
 */
export function getBackendUrl(): string {
  return BACKEND_URL;
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
