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
 * Check if Python is installed and available
 */
function isPythonAvailable(): { available: boolean; command: string; version?: string } {
  const pythonCommands = ['python3', 'python'];

  for (const cmd of pythonCommands) {
    try {
      const version = execSync(`${cmd} --version`, { encoding: 'utf8', timeout: 5000 }).trim();
      logMessage('info', `Found Python: ${cmd} (${version})`);
      return { available: true, command: cmd, version };
    } catch {
      // Try next command
    }
  }

  logMessage('error', 'Python not found in system PATH');
  return { available: false, command: '' };
}

/**
 * Get the path to the voice-engine backend
 */
function getVoiceEnginePath(): string {
  if (is.dev) {
    // Development: use relative path from project root
    return join(__dirname, '../../../../backend/voice-engine');
  } else {
    // Production: use extraResources path
    return join(process.resourcesPath, 'voice-engine');
  }
}

/**
 * Check if Python dependencies are installed for the voice-engine
 * IMPORTANT: Must check actual external dependencies (fastapi, uvicorn, etc.)
 * not just the local esoccer_voice module.
 * Uses the SAME environment that will be used for execution to avoid false positives.
 */
function checkPythonDependencies(pythonCmd: string, voiceEnginePath: string): { installed: boolean; error?: string; missingDeps?: string[] } {
  // List of critical dependencies that MUST be installed
  const criticalDependencies = [
    'fastapi',
    'uvicorn', 
    'pydub',
    'numpy',
    'faster_whisper',  // Critical for STT
  ];
  
  const missingDeps: string[] = [];
  
  // Build the same environment that will be used for execution
  const checkEnv = {
    ...process.env,
    PYTHONPATH: voiceEnginePath,
    PYTHONUNBUFFERED: '1',
  };
  
  try {
    // Check each critical dependency individually with the SAME env as execution
    for (const dep of criticalDependencies) {
      try {
        const result = execSync(
          `${pythonCmd} -c "import ${dep}; print('${dep} OK')"`,
          { 
            encoding: 'utf8', 
            timeout: 15000, 
            cwd: voiceEnginePath, 
            env: checkEnv,
            stdio: 'pipe' 
          }
        );
        logMessage('info', `Dependency check: ${dep} - OK`);
      } catch (depError) {
        logMessage('warn', `Missing Python dependency: ${dep}`);
        missingDeps.push(dep);
      }
    }
    
    if (missingDeps.length > 0) {
      return { 
        installed: false, 
        error: `Dependências não encontradas: ${missingDeps.join(', ')}`,
        missingDeps 
      };
    }
    
    // Also verify the esoccer_voice module structure (with same env)
    try {
      execSync(
        `${pythonCmd} -c "import sys; sys.path.insert(0, '${voiceEnginePath}'); from esoccer_voice.api import main; print('esoccer_voice OK')"`,
        { 
          encoding: 'utf8', 
          timeout: 15000, 
          cwd: voiceEnginePath, 
          env: checkEnv,
          stdio: 'pipe' 
        }
      );
      logMessage('info', 'esoccer_voice module check: OK');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logMessage('warn', `esoccer_voice module check failed: ${errorMsg}`);
      return { installed: false, error: `Módulo esoccer_voice não carrega: ${errorMsg}` };
    }
    
    logMessage('info', 'Python dependencies check passed (all critical deps verified)');
    return { installed: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logMessage('warn', `Python dependencies check failed: ${errorMsg}`);
    return { installed: false, error: errorMsg };
  }
}

/**
 * Try to install Python dependencies
 * Uses --user mode to avoid permission issues on Linux
 * Multiple strategies for different environments (AppImage, system install, etc.)
 */
async function installPythonDependencies(pythonCmd: string, voiceEnginePath: string): Promise<boolean> {
  logMessage('info', 'Attempting to install Python dependencies...');
  
  const requirementsPath = join(voiceEnginePath, 'requirements.txt');
  
  if (!existsSync(requirementsPath)) {
    logMessage('error', `requirements.txt not found at: ${requirementsPath}`);
    return false;
  }

  // Installation strategies to try in order
  const installStrategies = [
    // Strategy 1: --user with --break-system-packages (modern Python on Linux)
    `${pythonCmd} -m pip install --user --break-system-packages -r "${requirementsPath}"`,
    // Strategy 2: --user only (older pip versions)
    `${pythonCmd} -m pip install --user -r "${requirementsPath}"`,
    // Strategy 3: system-wide (requires permissions, may work on some systems)
    `${pythonCmd} -m pip install -r "${requirementsPath}"`,
  ];
  
  // First, try to upgrade pip (ignore errors)
  logMessage('info', 'Attempting to upgrade pip...');
  for (const upgradeCmd of [
    `${pythonCmd} -m pip install --user --break-system-packages --upgrade pip`,
    `${pythonCmd} -m pip install --user --upgrade pip`,
  ]) {
    try {
      execSync(upgradeCmd, {
        encoding: 'utf8',
        timeout: 60000,
        cwd: voiceEnginePath,
        stdio: 'pipe',
      });
      logMessage('info', 'Pip upgrade successful');
      break;
    } catch {
      // Continue to next strategy
    }
  }
  
  // Try each installation strategy
  for (let i = 0; i < installStrategies.length; i++) {
    const pipCmd = installStrategies[i];
    logMessage('info', `Install strategy ${i + 1}/${installStrategies.length}: ${pipCmd}`);
    
    try {
      execSync(pipCmd, {
        encoding: 'utf8',
        timeout: 900000, // 15 minute timeout for installation (large packages like whisper ~1GB)
        cwd: voiceEnginePath,
        stdio: 'pipe',
      });
      
      logMessage('info', `Strategy ${i + 1} completed, verifying installation...`);
      
      // Verify installation was successful
      const verifyResult = checkPythonDependencies(pythonCmd, voiceEnginePath);
      if (verifyResult.installed) {
        logMessage('info', 'Python dependencies installed and verified successfully');
        return true;
      } else {
        logMessage('warn', `Strategy ${i + 1} installed but verification failed: ${verifyResult.error}`);
        // Continue to next strategy
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logMessage('warn', `Strategy ${i + 1} failed: ${errorMsg}`);
      // Continue to next strategy
    }
  }
  
  // All strategies failed
  logMessage('error', 'All installation strategies failed');
  dialog.showErrorBox(
    'Falha na Instalação de Dependências',
    `Não foi possível instalar as dependências Python automaticamente.\n\n` +
    `Tente executar manualmente em um terminal:\n\n` +
    `cd "${voiceEnginePath}"\n` +
    `${pythonCmd} -m pip install --user -r requirements.txt\n\n` +
    `Se o erro persistir, verifique se você tem permissão para instalar pacotes Python.`
  );
  return false;
}

/**
 * Start the Python backend process
 */
async function startPythonBackend(): Promise<boolean> {
  const python = isPythonAvailable();

  if (!python.available) {
    backendError = 'Python 3.8+ não encontrado no sistema. Instale Python e reinicie o aplicativo.';
    dialog.showErrorBox(
      'Python não encontrado',
      'O E-Soccer Battle requer Python 3.8+ para funcionar.\n\n' +
        'Por favor, instale Python em:\n' +
        '- Windows: https://www.python.org/downloads/\n' +
        '- Linux: sudo apt install python3 python3-pip python3-venv\n\n' +
        'Após instalar, reinicie o aplicativo.'
    );
    return false;
  }

  const voiceEnginePath = getVoiceEnginePath();
  logMessage('info', `Voice engine path: ${voiceEnginePath}`);
  logMessage('info', `Running in ${is.dev ? 'development' : 'production'} mode`);
  logMessage('info', `resourcesPath: ${process.resourcesPath}`);
  logMessage('info', `userData: ${app.getPath('userData')}`);
  logMessage('info', `home: ${app.getPath('home')}`);

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

  // Check if dependencies are installed
  logMessage('info', `Checking Python dependencies with command: ${python.command}`);
  const depsCheck = checkPythonDependencies(python.command, voiceEnginePath);
  
  if (!depsCheck.installed) {
    logMessage('info', `Dependencies not installed: ${depsCheck.error}`);
    if (depsCheck.missingDeps) {
      logMessage('info', `Missing dependencies: ${depsCheck.missingDeps.join(', ')}`);
    }
    logMessage('info', 'Attempting auto-install...');
    
    // Show notification to user
    const shouldInstall = dialog.showMessageBoxSync({
      type: 'question',
      buttons: ['Instalar', 'Cancelar'],
      defaultId: 0,
      title: 'Instalar Dependências',
      message: 'As dependências Python do E-Soccer Battle precisam ser instaladas.',
      detail: 'Isso pode levar alguns minutos na primeira execução.\n\nDeseja instalar agora?'
    });
    
    if (shouldInstall === 0) {
      const installed = await installPythonDependencies(python.command, voiceEnginePath);
      if (!installed) {
        backendError = 'Falha ao instalar dependências Python. Execute manualmente:\n' +
          `cd "${voiceEnginePath}" && pip install -r requirements.txt`;
        dialog.showErrorBox('Erro de Instalação', backendError);
        return false;
      }
    } else {
      backendError = 'Instalação de dependências cancelada pelo usuário.';
      return false;
    }
  }

  try {
    // Start Python backend using the module
    logMessage('info', 'Starting Python voice-engine...');

    // Models directory - use app.getPath('userData') for writable storage
    // This is critical for AppImage which mounts as read-only
    const modelsDir = join(app.getPath('userData'), 'models');
    
    // Ensure models directory exists
    if (!existsSync(modelsDir)) {
      mkdirSync(modelsDir, { recursive: true });
      logMessage('info', `Created models directory: ${modelsDir}`);
    }

    const pythonArgs = ['-m', 'esoccer_voice.api.main'];
    const env = {
      ...process.env,
      PYTHONPATH: voiceEnginePath,
      PYTHONUNBUFFERED: '1',
      ESOCCER_MODELS_DIR: modelsDir,  // Pass writable models directory to Python
    };

    logMessage('info', `Command: ${python.command} ${pythonArgs.join(' ')}`);
    logMessage('info', `CWD: ${voiceEnginePath}`);
    logMessage('info', `PYTHONPATH: ${voiceEnginePath}`);
    logMessage('info', `ESOCCER_MODELS_DIR: ${modelsDir}`);

    pythonProcess = spawn(python.command, pythonArgs, {
      cwd: voiceEnginePath,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Capture startup errors
    let startupErrors: string[] = [];
    
    // Log stdout
    pythonProcess.stdout?.on('data', (data: Buffer) => {
      const msg = data.toString().trim();
      logMessage('info', `[stdout] ${msg}`);
    });

    // Log stderr
    pythonProcess.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString().trim();
      logMessage('error', `[stderr] ${msg}`);
      startupErrors.push(msg);
    });

    // Handle process exit
    pythonProcess.on('exit', (code, signal) => {
      logMessage('info', `Process exited with code ${code}, signal ${signal}`);
      if (code !== 0 && code !== null) {
        backendError = `Backend encerrou com erro (código ${code}).\n${startupErrors.slice(-3).join('\n')}`;
        // Notify renderer about backend failure
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('backend-error', backendError);
        }
      }
      pythonProcess = null;
    });

    // Handle process error
    pythonProcess.on('error', (err) => {
      backendError = `Erro ao iniciar backend: ${err.message}`;
      logMessage('error', backendError);
      pythonProcess = null;
    });

    // Wait for backend to be ready with health check
    const isReady = await waitForBackendReady(30000); // 30 second timeout
    
    if (isReady) {
      logMessage('info', 'Python voice-engine started and ready');
      backendError = null;
      return true;
    } else {
      backendError = 'Backend iniciou mas não respondeu ao health check.\n' +
        'Verifique os logs em: ' + join(app.getPath('userData'), 'logs', 'backend.log');
      logMessage('warn', 'Backend started but health check failed');
      
      // Check if process is still running
      if (pythonProcess && pythonProcess.exitCode === null) {
        logMessage('info', 'Process still running, may connect later');
        return true; // Let it try to connect later
      }
      
      return false;
    }
  } catch (error) {
    backendError = `Não foi possível iniciar o backend: ${error instanceof Error ? error.message : String(error)}`;
    logMessage('error', backendError);
    dialog.showErrorBox(
      'Erro ao iniciar backend',
      `${backendError}\n\n` +
        'Verifique se as dependências Python estão instaladas:\n' +
        `cd "${voiceEnginePath}" && pip install -r requirements.txt`
    );
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
  
  // Start download process
  ipcMain.handle('start-download', async () => {
    logMessage('info', 'Download started via IPC');
    
    const sendProgress = (stage: string, percentage: number, message: string) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download-progress', { stage, percentage, message });
      }
    };
    
    // Initial system check
    sendProgress('checking', 5, 'Verificando sistema...');
    await new Promise(r => setTimeout(r, 300));
    
    // Check Python availability
    const python = isPythonAvailable();
    if (!python.available) {
      sendProgress('error', 0, 'Python 3.8+ não encontrado. Instale Python e reinicie.');
      return { success: false, error: 'Python não encontrado' };
    }
    
    sendProgress('checking', 8, `Python encontrado: ${python.version}`);
    await new Promise(r => setTimeout(r, 300));
    
    // Check Python dependencies FIRST
    const voiceEnginePath = getVoiceEnginePath();
    logMessage('info', `Voice engine path for download: ${voiceEnginePath}`);
    sendProgress('dependencies', 10, 'Verificando dependências Python...');
    
    const depsCheck = checkPythonDependencies(python.command, voiceEnginePath);
    
    if (!depsCheck.installed) {
      logMessage('info', `Dependencies missing: ${depsCheck.error}`);
      
      // Show which dependencies are missing
      if (depsCheck.missingDeps && depsCheck.missingDeps.length > 0) {
        sendProgress('dependencies', 12, `Faltando: ${depsCheck.missingDeps.join(', ')}`);
      } else {
        sendProgress('dependencies', 12, 'Instalando dependências Python...');
      }
      
      await new Promise(r => setTimeout(r, 500));
      sendProgress('dependencies', 15, 'Baixando FastAPI, Whisper, Kokoro... (pode demorar)');
      
      // Use the improved installPythonDependencies function
      const installed = await installPythonDependencies(python.command, voiceEnginePath);
      
      if (!installed) {
        sendProgress('error', 0, 'Falha ao instalar dependências. Veja instruções no terminal.');
        return { success: false, error: 'Falha ao instalar dependências Python' };
      }
      
      sendProgress('dependencies', 18, 'Verificando instalação...');
    }
    
    sendProgress('dependencies', 20, 'Dependências OK');
    await new Promise(r => setTimeout(r, 300));
    
    // Check if backend is running, start if needed
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
    
    // Start model download
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
