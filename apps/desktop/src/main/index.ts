/**
 * E-Soccer Battle - Electron Main Process
 * Handles window creation and Python backend lifecycle
 * Follows SOLID + KISS + camelCase
 */

import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { join } from 'path';
import { spawn, ChildProcess, execSync } from 'child_process';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { SetupError, createSetupError } from '../shared/SetupError';

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
let backendError: SetupError | null = null;

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
 * Check if critical Python dependencies are importable.
 * Uses a SINGLE Python subprocess to avoid repeated cold-start overhead.
 * On Windows, native DLLs (ctranslate2/torch) can take 20-30s on first load,
 * so we use a generous 120s timeout for the whole batch.
 */
function checkPythonDependencies(pythonCmd: string, voiceEnginePath: string): { installed: boolean; setupError?: SetupError } {
  const criticalDependencies = ['fastapi', 'uvicorn', 'pydub', 'numpy', 'faster_whisper'];
  const checkEnv = buildPythonEnv(voiceEnginePath);
  const isWindows = process.platform === 'win32';

  // Build a single Python script that checks all deps at once
  // We write to a temp file to avoid Windows cmd.exe quoting issues
  const checkScript = [
    'import sys, json, traceback',
    `deps = ${JSON.stringify(criticalDependencies)}`,
    'results = {}',
    'for dep in deps:',
    '    try:',
    '        __import__(dep)',
    '        results[dep] = {"ok": True}',
    '    except Exception:',
    '        results[dep] = {"ok": False, "error": traceback.format_exc()}',
    'try:',
    `    sys.path.insert(0, ${JSON.stringify(voiceEnginePath.replace(/\\/g, '/'))})`,
    '    from esoccer_voice.api import main',
    '    results["esoccer_voice"] = {"ok": True}',
    'except Exception:',
    '    results["esoccer_voice"] = {"ok": False, "error": traceback.format_exc()}',
    'print(json.dumps(results))',
  ].join('\n');

  const tmpScript = join(app.getPath('temp'), 'esoccer_dep_check.py');

  try {
    writeFileSync(tmpScript, checkScript, 'utf8');
    logMessage('info', 'Checking Python dependencies (batch import)...');
    const output = execSync(
      `"${pythonCmd}" "${tmpScript}"`,
      { encoding: 'utf8', timeout: 120000, cwd: voiceEnginePath, env: checkEnv, stdio: ['ignore', 'pipe', 'pipe'] }
    );

    const results = JSON.parse(output.trim());
    const missingDeps: string[] = [];
    const importErrors: string[] = [];

    for (const dep of criticalDependencies) {
      if (results[dep]?.ok) {
        logMessage('info', `Dependency check: ${dep} - OK`);
      } else {
        logMessage('warn', `Missing Python dependency: ${dep}`);
        missingDeps.push(dep);
        if (results[dep]?.error) importErrors.push(`[${dep}] ${results[dep].error}`);
      }
    }

    // Check esoccer_voice separately
    if (results['esoccer_voice']?.ok) {
      logMessage('info', 'esoccer_voice module check: OK');
    } else {
      logMessage('warn', 'esoccer_voice module failed to load');
      return {
        installed: false,
        setupError: createSetupError(
          'DEPS_IMPORT_FAIL',
          'Módulo esoccer_voice não carrega',
          results['esoccer_voice']?.error || 'Erro desconhecido',
          isWindows,
        ),
      };
    }

    if (missingDeps.length > 0) {
      const details = importErrors.length > 0
        ? `Tracebacks:\n${importErrors.join('\n\n')}`
        : undefined;
      return {
        installed: false,
        setupError: createSetupError(
          importErrors.length > 0 ? 'DEPS_IMPORT_FAIL' : 'DEPS_MISSING',
          `Dependências não encontradas: ${missingDeps.join(', ')}`,
          details,
          isWindows,
        ),
      };
    }

    logMessage('info', 'Python dependencies check passed');
    return { installed: true };
  } catch (error) {
    const stderr = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr).trim() : '';
    const isTimeout = error instanceof Error && error.message.includes('ETIMEDOUT');
    return {
      installed: false,
      setupError: createSetupError(
        isTimeout ? 'BACKEND_TIMEOUT' : 'UNKNOWN',
        isTimeout
          ? 'Verificação de dependências excedeu o tempo limite (120s). O sistema pode estar lento.'
          : `Erro ao verificar dependências: ${error instanceof Error ? error.message : String(error)}`,
        stderr || undefined,
        isWindows,
      ),
    };
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
  const isWindows = process.platform === 'win32';
  const pythonCmd = getPythonCmd();

  if (!pythonCmd) {
    backendError = createSetupError(
      isWindows ? 'PYTHON_EMBEDDED_MISSING' : 'PYTHON_NOT_FOUND',
      isWindows
        ? 'O Python embutido não foi encontrado. Reinstale o aplicativo.'
        : 'Python 3.10+ não encontrado. Instale com: sudo apt install python3 python3-pip',
      undefined,
      isWindows,
    );
    logMessage('error', `[${backendError.code}] ${backendError.message}`);
    return false;
  }

  const voiceEnginePath = getVoiceEnginePath();
  logMessage('info', `Voice engine path: ${voiceEnginePath}`);
  logMessage('info', `Python command: ${pythonCmd}`);
  logMessage('info', `Running in ${is.dev ? 'development' : 'production'} mode`);

  if (!existsSync(voiceEnginePath)) {
    backendError = createSetupError(
      'BACKEND_NOT_FOUND',
      `O backend de voz não foi encontrado em: ${voiceEnginePath}`,
      'Verifique se a instalação foi concluída corretamente.',
      isWindows,
    );
    logMessage('error', `[${backendError.code}] ${backendError.message}`);
    return false;
  }

  // Verify dependencies are available
  const depsCheck = checkPythonDependencies(pythonCmd, voiceEnginePath);
  if (!depsCheck.installed) {
    backendError = depsCheck.setupError!;
    logMessage('warn', `[${backendError.code}] ${backendError.message}`);
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
        const stderrFull = startupErrors.join('\n');
        backendError = createSetupError(
          'BACKEND_CRASH',
          `Backend encerrou com erro (código ${code})`,
          stderrFull || undefined,
          process.platform === 'win32',
        );
        logMessage('error', `[${backendError.code}] exit code ${code}`);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('backend-error', backendError);
        }
      }
      pythonProcess = null;
    });

    pythonProcess.on('error', (err) => {
      backendError = createSetupError(
        'BACKEND_CRASH',
        `Não foi possível iniciar o processo Python: ${err.message}`,
        err.stack,
        process.platform === 'win32',
      );
      logMessage('error', `[${backendError.code}] ${err.message}`);
      pythonProcess = null;
    });

    const isReady = await waitForBackendReady(30000);

    if (isReady) {
      logMessage('info', 'Python voice-engine started and ready');
      backendError = null;
      return true;
    }

    const logPath = join(app.getPath('userData'), 'logs', 'backend.log');
    backendError = createSetupError(
      'BACKEND_TIMEOUT',
      'Backend iniciou mas não respondeu ao health check após 30 segundos',
      `Verifique os logs em: ${logPath}\n\nÚltimos erros:\n${startupErrors.slice(-5).join('\n')}`,
      process.platform === 'win32',
    );
    logMessage('warn', `[${backendError.code}] health check timed out`);

    if (pythonProcess && pythonProcess.exitCode === null) {
      logMessage('info', 'Process still running, may connect later');
      return true;
    }

    return false;
  } catch (error) {
    backendError = createSetupError(
      'UNKNOWN',
      `Não foi possível iniciar o backend: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error.stack : undefined,
      process.platform === 'win32',
    );
    logMessage('error', `[${backendError.code}] ${backendError.message}`);
    return false;
  }
}

/**
 * Stop the Python backend process
 * NOTE: SIGTERM/SIGKILL are POSIX-only. On Windows, we must use
 *       `taskkill /T /F` to kill the process tree (Python may spawn
 *       child processes like uvicorn workers that would otherwise linger
 *       and lock files, causing "re-download dependencies" on next launch).
 */
function stopPythonBackend(): void {
  if (!pythonProcess) return;

  const pid = pythonProcess.pid;
  logMessage('info', `Stopping Python voice-engine (pid: ${pid})...`);

  try {
    if (process.platform === 'win32') {
      // On Windows, SIGTERM = immediate kill (no graceful shutdown).
      // Use taskkill /T to kill the entire process tree so no child
      // processes (uvicorn workers, etc.) survive and hold locks.
      const { execSync } = require('child_process');
      try {
        execSync(`taskkill /pid ${pid} /T /F`, {
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 5000,
        });
        logMessage('info', 'Process tree killed via taskkill');
      } catch {
        // Fallback if taskkill fails (process may have already exited)
        logMessage('warn', 'taskkill failed, process may have already exited');
        try {
          pythonProcess.kill();
        } catch {
          // Already dead
        }
      }
    } else {
      // POSIX: try graceful shutdown first
      pythonProcess.kill('SIGTERM');

      // Force kill after timeout
      setTimeout(() => {
        if (pythonProcess) {
          logMessage('info', 'Force killing process (SIGKILL)...');
          try {
            pythonProcess.kill('SIGKILL');
          } catch {
            // Already dead
          }
          pythonProcess = null;
        }
      }, 3000);
    }
  } catch (err) {
    logMessage('warn', `Error stopping process: ${err instanceof Error ? err.message : String(err)}`);
  }

  pythonProcess = null;
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
): Promise<{ success: boolean; setupError?: SetupError }> {
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
          return { success: false, setupError: backendError || createSetupError('UNKNOWN', 'Falha ao iniciar backend', undefined, process.platform === 'win32') };
        }
        // Wait again after starting
        const isReady = await waitForBackendReady(30000);
        if (!isReady) {
          return { success: false, setupError: createSetupError('BACKEND_TIMEOUT', 'Backend iniciou mas não respondeu', undefined, process.platform === 'win32') };
        }
      } else {
        return { success: false, setupError: createSetupError('BACKEND_HEALTH_FAIL', 'Backend não está respondendo. Verifique os logs.', undefined, process.platform === 'win32') };
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
      return {
        success: false,
        setupError: createSetupError(
          'MODEL_DOWNLOAD_FAIL',
          `Download falhou (HTTP ${response.status})`,
          errorText,
          process.platform === 'win32',
        ),
      };
    }

    const result = await response.json();

    if (result.whisperReady && result.kokoroReady) {
      onProgress('complete', 100, 'Modelos baixados com sucesso!');
      return { success: true };
    } else {
      const failedModels = [
        !result.whisperReady ? 'Whisper' : '',
        !result.kokoroReady ? 'Kokoro' : '',
      ].filter(Boolean).join(', ');
      return {
        success: false,
        setupError: createSetupError(
          'MODEL_DOWNLOAD_FAIL',
          `Download incompleto — modelo(s) faltando: ${failedModels}`,
          `Whisper: ${result.whisperReady ? 'OK' : 'FALHOU'}\nKokoro: ${result.kokoroReady ? 'OK' : 'FALHOU'}`,
          process.platform === 'win32',
        ),
      };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logMessage('error', `Download models failed: ${errorMsg}`);
    const isTimeout = errorMsg.includes('timeout') || errorMsg.includes('abort');
    return {
      success: false,
      setupError: createSetupError(
        isTimeout ? 'MODEL_DOWNLOAD_TIMEOUT' : 'MODEL_DOWNLOAD_FAIL',
        isTimeout
          ? 'Download demorou mais de 10 minutos. Verifique sua conexão.'
          : `Falha no download: ${errorMsg}`,
        error instanceof Error ? error.stack : undefined,
        process.platform === 'win32',
      ),
    };
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

  // Open logs folder in file explorer
  ipcMain.handle('open-logs', () => {
    const logPath = join(app.getPath('userData'), 'logs', 'backend.log');
    shell.showItemInFolder(logPath);
  });

  // Restart backend
  ipcMain.handle('restart-backend', async () => {
    logMessage('info', 'Restart backend requested via IPC');
    stopPythonBackend();

    // Wait a bit for cleanup
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const success = await startPythonBackend();
    return { success, error: backendError?.message || null, setupError: backendError };
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
      const err = createSetupError(
        process.platform === 'win32' ? 'PYTHON_EMBEDDED_MISSING' : 'PYTHON_NOT_FOUND',
        'Python não encontrado. Reinstale o aplicativo.',
        undefined,
        process.platform === 'win32',
      );
      sendProgress('error', 0, err.message);
      return { success: false, setupError: err };
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
        const err = backendError || createSetupError('UNKNOWN', 'Falha ao iniciar backend', undefined, process.platform === 'win32');
        sendProgress('error', 0, err.message);
        return { success: false, setupError: err };
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
      sendProgress('error', 0, result.setupError?.message || 'Erro desconhecido');
      return { success: false, setupError: result.setupError };
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
  // On non-macOS, quitting will trigger before-quit which handles process cleanup
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup on app quit
app.on('before-quit', () => {
  // Synchronous cleanup — before-quit fires before windows are closed,
  // so we must kill the process tree synchronously to avoid lingering
  // Python processes that could lock files and break the next launch.
  if (pythonProcess) {
    const pid = pythonProcess.pid;
    logMessage('info', `before-quit: killing Python process tree (pid: ${pid})`);
    try {
      if (process.platform === 'win32') {
        const { execSync } = require('child_process');
        try {
          execSync(`taskkill /pid ${pid} /T /F`, {
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 5000,
          });
        } catch { /* already dead */ }
      } else {
        try { pythonProcess.kill('SIGTERM'); } catch { /* already dead */ }
      }
    } catch { /* best effort */ }
    pythonProcess = null;
  }
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('[App] Uncaught exception:', error);
  stopPythonBackend();
});
