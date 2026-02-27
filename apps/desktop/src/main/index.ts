/**
 * E-Soccer Battle - Electron Main Process
 * Handles window creation and Python backend lifecycle
 * Follows SOLID + KISS + camelCase
 */

import { app, BrowserWindow, shell, dialog, ipcMain } from 'electron';
import { join } from 'path';
import { spawn, ChildProcess, execSync } from 'child_process';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';

// Disable GPU acceleration for headless/server environments
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

// Set environment variable for database path (used by preload script)
// Must be set before BrowserWindow is created
process.env.ESOCCER_USER_DATA = app.getPath('userData');

// Python backend process reference
let pythonProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;
let backendError: string | null = null;

const PYTHON_BACKEND_URL = 'http://127.0.0.1:8001';

/**
 * Log to both console and file for debugging production issues
 */
function logMessage(level: 'info' | 'error' | 'warn', message: string): void {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

  if (level === 'error') {
    console.error(logLine);
  } else if (level === 'warn') {
    console.warn(logLine);
  } else {
    console.log(logLine);
  }

  // Write to log file for debugging
  try {
    const logDir = join(app.getPath('userData'), 'logs');
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }
    const logFile = join(logDir, 'backend.log');
    writeFileSync(logFile, logLine + '\n', { flag: 'a' });
  } catch {
    // Ignore log file errors
  }
}

/**
 * Wait for backend to be ready with health check polling
 */
async function waitForBackendReady(timeoutMs: number = 30000): Promise<boolean> {
  const startTime = Date.now();
  const pollInterval = 500;

  logMessage('info', 'Waiting for backend to be ready...');

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(`${PYTHON_BACKEND_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'ok') {
          logMessage('info', 'Health check passed');
          return true;
        }
      }
    } catch {
      // Backend not ready yet, continue polling
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  logMessage('warn', `Health check timed out after ${timeoutMs}ms`);
  return false;
}

/**
 * Get the Python executable command.
 * Windows (production): uses embedded standalone Python from extraResources.
 * Windows (dev): uses standalone Python from local python-standalone/ dir.
 * Linux: falls back to system Python (python3 or python).
 */
function getPythonCmd(): string {
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    // Embedded standalone Python (pre-built with all deps)
    const embeddedPath = is.dev
      ? join(__dirname, '../../../../apps/desktop/python-standalone/python/python.exe')
      : join(process.resourcesPath, 'python-standalone', 'python', 'python.exe');

    if (existsSync(embeddedPath)) {
      logMessage('info', `Using embedded Python: ${embeddedPath}`);
      return embeddedPath;
    }

    logMessage('warn', `Embedded Python not found at: ${embeddedPath}`);
  }

  // Linux fallback: find system Python
  for (const cmd of ['python3', 'python']) {
    try {
      const version = execSync(`${cmd} --version`, {
        encoding: 'utf8',
        timeout: 3000,
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();

      if (version.toLowerCase().startsWith('python')) {
        logMessage('info', `Using system Python: ${cmd} (${version})`);
        return cmd;
      }
    } catch {
      // Try next
    }
  }

  return '';
}

/**
 * Get the path to the voice-engine backend
 */
function getVoiceEnginePath(): string {
  if (is.dev) {
    return join(__dirname, '../../../../backend/voice-engine');
  }
  return join(process.resourcesPath, 'voice-engine');
}

/**
 * Check if critical Python dependencies are importable
 */
function checkPythonDependencies(pythonCmd: string, voiceEnginePath: string): { installed: boolean; error?: string; missingDeps?: string[] } {
  const criticalDependencies = ['fastapi', 'uvicorn', 'pydub', 'numpy', 'faster_whisper'];
  const missingDeps: string[] = [];
  const checkEnv = buildPythonEnv(voiceEnginePath);
  const safePath = voiceEnginePath.replace(/\\/g, '\\\\');

  try {
    for (const dep of criticalDependencies) {
      try {
        execSync(
          `"${pythonCmd}" -c "import ${dep}; print('${dep} OK')"`,
          { encoding: 'utf8', timeout: 15000, cwd: voiceEnginePath, env: checkEnv, stdio: ['ignore', 'pipe', 'pipe'] }
        );
        logMessage('info', `Dependency check: ${dep} - OK`);
      } catch {
        logMessage('warn', `Missing Python dependency: ${dep}`);
        missingDeps.push(dep);
      }
    }

    if (missingDeps.length > 0) {
      return { installed: false, error: `Dependências não encontradas: ${missingDeps.join(', ')}`, missingDeps };
    }

    // Verify esoccer_voice module
    try {
      execSync(
        `"${pythonCmd}" -c "import sys; sys.path.insert(0, '${safePath}'); from esoccer_voice.api import main; print('esoccer_voice OK')"`,
        { encoding: 'utf8', timeout: 15000, cwd: voiceEnginePath, env: checkEnv, stdio: ['ignore', 'pipe', 'pipe'] }
      );
      logMessage('info', 'esoccer_voice module check: OK');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { installed: false, error: `Módulo esoccer_voice não carrega: ${errorMsg}` };
    }

    logMessage('info', 'Python dependencies check passed');
    return { installed: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { installed: false, error: errorMsg };
  }
}

/**
 * Build environment variables for Python subprocess execution
 */
function buildPythonEnv(voiceEnginePath: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PYTHONPATH: voiceEnginePath,
    PYTHONUNBUFFERED: '1',
    PIP_NO_INPUT: '1',
    PYTHON_KEYRING_BACKEND: 'keyring.backends.null.Keyring',
  };
}

/**
 * Start the Python backend process
 */
async function startPythonBackend(): Promise<boolean> {
  const pythonCmd = getPythonCmd();

  if (!pythonCmd) {
    backendError = 'Python não encontrado. Verifique a instalação do aplicativo.';
    logMessage('error', backendError);
    dialog.showErrorBox(
      'Python não encontrado',
      process.platform === 'win32'
        ? 'O Python embutido não foi encontrado. Reinstale o aplicativo.'
        : 'Python 3.10+ não encontrado.\nInstale com: sudo apt install python3 python3-pip'
    );
    return false;
  }

  const voiceEnginePath = getVoiceEnginePath();
  logMessage('info', `Voice engine path: ${voiceEnginePath}`);
  logMessage('info', `Python command: ${pythonCmd}`);
  logMessage('info', `Running in ${is.dev ? 'development' : 'production'} mode`);

  if (!existsSync(voiceEnginePath)) {
    backendError = `Backend não encontrado em: ${voiceEnginePath}`;
    logMessage('error', backendError);
    dialog.showErrorBox(
      'Backend não encontrado',
      `O backend de voz não foi encontrado em:\n${voiceEnginePath}\n\n` +
      'Verifique se a instalação foi concluída corretamente.'
    );
    return false;
  }

  // Verify dependencies are available
  const depsCheck = checkPythonDependencies(pythonCmd, voiceEnginePath);
  if (!depsCheck.installed) {
    logMessage('warn', `Dependencies check failed: ${depsCheck.error}`);
    // On Windows, deps should be pre-installed — this is a broken install
    if (process.platform === 'win32') {
      backendError = `Dependências não encontradas no Python embutido: ${depsCheck.error}`;
      dialog.showErrorBox('Instalação Incompleta', `${backendError}\n\nReinstale o aplicativo.`);
      return false;
    }
    // On Linux, user needs to install deps manually
    backendError = `Dependências faltando: ${depsCheck.error}`;
    dialog.showErrorBox(
      'Dependências Faltando',
      `${backendError}\n\nInstale com:\npip install -r "${join(voiceEnginePath, 'requirements.txt')}"`
    );
    return false;
  }

  try {
    logMessage('info', 'Starting Python voice-engine...');

    // Models directory — writable storage (critical for read-only installs)
    const modelsDir = join(app.getPath('userData'), 'models');
    if (!existsSync(modelsDir)) {
      mkdirSync(modelsDir, { recursive: true });
      logMessage('info', `Created models directory: ${modelsDir}`);
    }

    const pythonArgs = ['-m', 'esoccer_voice.api.main'];
    const env = {
      ...buildPythonEnv(voiceEnginePath),
      ESOCCER_MODELS_DIR: modelsDir,
    };

    logMessage('info', `Command: ${pythonCmd} ${pythonArgs.join(' ')}`);
    logMessage('info', `ESOCCER_MODELS_DIR: ${modelsDir}`);

    pythonProcess = spawn(pythonCmd, pythonArgs, {
      cwd: voiceEnginePath,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const startupErrors: string[] = [];

    pythonProcess.stdout?.on('data', (data: Buffer) => {
      logMessage('info', `[stdout] ${data.toString().trim()}`);
    });

    pythonProcess.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString().trim();
      logMessage('error', `[stderr] ${msg}`);
      startupErrors.push(msg);
    });

    pythonProcess.on('exit', (code, signal) => {
      logMessage('info', `Process exited with code ${code}, signal ${signal}`);
      if (code !== 0 && code !== null) {
        backendError = `Backend encerrou com erro (código ${code}).\n${startupErrors.slice(-3).join('\n')}`;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('backend-error', backendError);
        }
      }
      pythonProcess = null;
    });

    pythonProcess.on('error', (err) => {
      backendError = `Erro ao iniciar backend: ${err.message}`;
      logMessage('error', backendError);
      pythonProcess = null;
    });

    const isReady = await waitForBackendReady(30000);

    if (isReady) {
      logMessage('info', 'Python voice-engine started and ready');
      backendError = null;
      return true;
    }

    backendError = 'Backend iniciou mas não respondeu ao health check.\n' +
      'Verifique os logs em: ' + join(app.getPath('userData'), 'logs', 'backend.log');
    logMessage('warn', 'Backend started but health check failed');

    if (pythonProcess && pythonProcess.exitCode === null) {
      logMessage('info', 'Process still running, may connect later');
      return true;
    }

    return false;
  } catch (error) {
    backendError = `Não foi possível iniciar o backend: ${error instanceof Error ? error.message : String(error)}`;
    logMessage('error', backendError);
    dialog.showErrorBox('Erro ao iniciar backend', backendError);
    return false;
  }
}

/**
 * Stop the Python backend process
 */
function stopPythonBackend(): void {
  if (pythonProcess) {
    console.log('[Backend] Stopping Python voice-engine...');

    // Try graceful shutdown first
    pythonProcess.kill('SIGTERM');

    // Force kill after timeout
    setTimeout(() => {
      if (pythonProcess) {
        console.log('[Backend] Force killing process...');
        pythonProcess.kill('SIGKILL');
        pythonProcess = null;
      }
    }, 3000);
  }
}

/**
 * Create the main application window
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: true,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    title: 'E-Soccer Battle - Volta 6',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
    if (is.dev) {
      mainWindow?.webContents.openDevTools();
    }
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Load renderer
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../../dist/index.html'));
  }
}

/**
 * Check if models are already downloaded
 * IMPORTANT: Uses the same writable models directory as the Python backend
 * (app.getPath('userData')/models) to ensure consistency
 */
function checkModelsExist(): { whisperReady: boolean; kokoroReady: boolean; modelsDir: string } {
  // Use the same writable models directory as startPythonBackend()
  const modelsDir = join(app.getPath('userData'), 'models');
  const whisperDir = join(modelsDir, 'whisper');
  const kokoroDir = join(modelsDir, 'kokoro');

  logMessage('info', `Checking models in: ${modelsDir}`);

  // Check for whisper model files
  let whisperReady = false;
  if (existsSync(whisperDir)) {
    try {
      const { readdirSync } = require('fs');
      const files = readdirSync(whisperDir, { recursive: true }) as string[];
      whisperReady = files.some((f: string) =>
        f.endsWith('.bin') || f.endsWith('.ct2') || f.endsWith('.onnx')
      );
      logMessage('info', `Whisper dir exists, model ready: ${whisperReady}, files: ${files.length}`);
    } catch (e) {
      logMessage('warn', `Error checking whisper dir: ${e}`);
      whisperReady = false;
    }
  } else {
    logMessage('info', `Whisper dir does not exist: ${whisperDir}`);
  }

  // Check for kokoro model files
  let kokoroReady = false;
  if (existsSync(kokoroDir)) {
    try {
      const { readdirSync } = require('fs');
      const files = readdirSync(kokoroDir, { recursive: true }) as string[];
      kokoroReady = files.some((f: string) =>
        f.endsWith('.pth') || f.endsWith('.pt') || f.endsWith('.bin') || f.endsWith('.onnx')
      );
      logMessage('info', `Kokoro dir exists, model ready: ${kokoroReady}, files: ${files.length}`);
    } catch (e) {
      logMessage('warn', `Error checking kokoro dir: ${e}`);
      kokoroReady = false;
    }
  } else {
    logMessage('info', `Kokoro dir does not exist: ${kokoroDir}`);
  }

  logMessage('info', `Models check result: whisper=${whisperReady}, kokoro=${kokoroReady}`);
  return { whisperReady, kokoroReady, modelsDir };
}

/**
 * Download models via Python backend API
 */
async function downloadModels(
  onProgress: (stage: string, percentage: number, message: string) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    onProgress('checking', 5, 'Verificando backend...');

    // Ensure backend is running - give it more time (60s) on first run
    const isBackendUp = await waitForBackendReady(60000);
    if (!isBackendUp) {
      // Try to start backend if not running
      if (!pythonProcess || pythonProcess.exitCode !== null) {
        logMessage('info', 'Backend not running, attempting to start...');
        onProgress('checking', 8, 'Iniciando backend...');
        const started = await startPythonBackend();
        if (!started) {
          return { success: false, error: backendError || 'Falha ao iniciar backend' };
        }
        // Wait again after starting
        const isReady = await waitForBackendReady(30000);
        if (!isReady) {
          return { success: false, error: 'Backend iniciou mas não respondeu' };
        }
      } else {
        return { success: false, error: 'Backend não está respondendo. Verifique os logs.' };
      }
    }

    onProgress('dependencies', 15, 'Iniciando download dos modelos...');

    // Call the models/download endpoint
    const response = await fetch(`${PYTHON_BACKEND_URL}/models/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(600000), // 10 minute timeout for downloads
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Download falhou: ${errorText}` };
    }

    const result = await response.json();

    if (result.whisperReady && result.kokoroReady) {
      onProgress('complete', 100, 'Modelos baixados com sucesso!');
      return { success: true };
    } else {
      return {
        success: false,
        error: `Modelos não prontos: Whisper=${result.whisperReady}, Kokoro=${result.kokoroReady}`
      };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logMessage('error', `Download models failed: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

/**
 * Setup IPC handlers for backend management
 */
function setupIpcHandlers(): void {
  // Get backend status
  ipcMain.handle('get-backend-status', () => {
    return {
      running: pythonProcess !== null && pythonProcess.exitCode === null,
      error: backendError,
      url: PYTHON_BACKEND_URL,
      logPath: join(app.getPath('userData'), 'logs', 'backend.log'),
    };
  });

  // Restart backend
  ipcMain.handle('restart-backend', async () => {
    logMessage('info', 'Restart backend requested via IPC');
    stopPythonBackend();

    // Wait a bit for cleanup
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const success = await startPythonBackend();
    return { success, error: backendError };
  });

  // Get logs path
  ipcMain.handle('get-logs-path', () => {
    return join(app.getPath('userData'), 'logs', 'backend.log');
  });

  // Check if this is first run (models not downloaded)
  ipcMain.handle('check-first-run', () => {
    const modelsStatus = checkModelsExist();
    const isFirstRun = !modelsStatus.whisperReady || !modelsStatus.kokoroReady;
    logMessage('info', `First run check: ${isFirstRun}`);
    return {
      isFirstRun,
      modelsStatus,
    };
  });

  // Start download process (models only — deps are pre-installed at build time)
  ipcMain.handle('start-download', async () => {
    logMessage('info', 'Download started via IPC');

    const sendProgress = (stage: string, percentage: number, message: string) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download-progress', { stage, percentage, message });
      }
    };

    sendProgress('checking', 5, 'Verificando sistema...');
    await new Promise(r => setTimeout(r, 300));

    // Verify Python is available
    const pythonCmd = getPythonCmd();
    if (!pythonCmd) {
      sendProgress('error', 0, 'Python não encontrado. Reinstale o aplicativo.');
      return { success: false, error: 'Python não encontrado' };
    }

    sendProgress('checking', 10, 'Python OK');
    sendProgress('dependencies', 20, 'Dependências OK');
    await new Promise(r => setTimeout(r, 300));

    // Start backend if needed
    sendProgress('backend', 22, 'Verificando backend...');

    if (!pythonProcess || pythonProcess.exitCode !== null) {
      logMessage('info', 'Backend not running, starting...');
      sendProgress('backend', 24, 'Iniciando backend Python...');

      const started = await startPythonBackend();
      if (!started) {
        const errorMsg = backendError || 'Falha ao iniciar backend';
        sendProgress('error', 0, errorMsg);
        return { success: false, error: errorMsg };
      }
    }

    sendProgress('backend', 28, 'Backend pronto');
    await new Promise(r => setTimeout(r, 300));

    // Download models
    sendProgress('whisper', 30, 'Iniciando download do Whisper (~1GB)...');

    const result = await downloadModels(sendProgress);

    if (result.success) {
      sendProgress('complete', 100, 'Instalação completa!');
      return { success: true };
    } else {
      sendProgress('error', 0, result.error || 'Erro desconhecido');
      return { success: false, error: result.error };
    }
  });

  // Get loading progress (for subsequent runs)
  ipcMain.handle('check-backend-ready', async () => {
    try {
      const response = await fetch(`${PYTHON_BACKEND_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        return { ready: data.status === 'ok', status: data };
      }
      return { ready: false, status: null };
    } catch {
      return { ready: false, status: null };
    }
  });
}

// Application lifecycle
app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.esoccer-battle.desktop');

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // Setup IPC handlers first
  setupIpcHandlers();

  // Start Python backend
  const backendStarted = await startPythonBackend();
  if (!backendStarted) {
    logMessage('warn', 'Backend failed to start, app will run with limited functionality');
  }

  // Create window
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Cleanup on window close
app.on('window-all-closed', () => {
  stopPythonBackend();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup on app quit
app.on('before-quit', () => {
  stopPythonBackend();
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('[App] Uncaught exception:', error);
  stopPythonBackend();
});
