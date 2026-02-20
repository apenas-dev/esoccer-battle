import { spawn, ChildProcess } from 'child_process';
import { setTimeout as delay } from 'timers/promises';
import path from 'path';

const BACKEND_URL = 'http://127.0.0.1:8001';
const HEALTH_CHECK_INTERVAL = 500; // ms
const HEALTH_CHECK_TIMEOUT = 30000; // 30 segundos

let pythonProcess: ChildProcess | null = null;

/**
 * Inicia o servidor Python do voice-engine
 */
export async function startPythonBackend(): Promise<void> {
  if (pythonProcess) {
    console.log('[setup] Backend Python já está rodando');
    return;
  }

  const backendPath = path.resolve(__dirname, '../../../../backend/voice-engine');
  
  console.log('[setup] Iniciando backend Python...');
  console.log(`[setup] Diretório: ${backendPath}`);

  pythonProcess = spawn('python', ['-m', 'esoccer_voice.api.main'], {
    cwd: backendPath,
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  pythonProcess.stdout?.on('data', (data) => {
    console.log(`[backend] ${data.toString().trim()}`);
  });

  pythonProcess.stderr?.on('data', (data) => {
    console.error(`[backend:err] ${data.toString().trim()}`);
  });

  pythonProcess.on('error', (err) => {
    console.error('[setup] Erro ao iniciar backend:', err);
  });

  pythonProcess.on('exit', (code) => {
    console.log(`[setup] Backend encerrado com código: ${code}`);
    pythonProcess = null;
  });

  await waitForHealthCheck();
  console.log('[setup] Backend pronto!');
}

/**
 * Encerra o servidor Python
 */
export async function stopPythonBackend(): Promise<void> {
  if (!pythonProcess) {
    console.log('[setup] Nenhum backend para encerrar');
    return;
  }

  console.log('[setup] Encerrando backend Python...');
  
  return new Promise((resolve) => {
    pythonProcess!.on('exit', () => {
      pythonProcess = null;
      console.log('[setup] Backend encerrado com sucesso');
      resolve();
    });

    pythonProcess!.kill('SIGTERM');

    // Força encerramento após 5 segundos
    setTimeout(() => {
      if (pythonProcess) {
        console.log('[setup] Forçando encerramento...');
        pythonProcess.kill('SIGKILL');
      }
    }, 5000);
  });
}

/**
 * Aguarda o endpoint /health responder OK
 */
export async function waitForHealthCheck(): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < HEALTH_CHECK_TIMEOUT) {
    try {
      const response = await fetch(`${BACKEND_URL}/health`);
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'ok') {
          return;
        }
      }
    } catch {
      // Servidor ainda não está pronto
    }
    
    await delay(HEALTH_CHECK_INTERVAL);
  }

  throw new Error(`Health check timeout após ${HEALTH_CHECK_TIMEOUT}ms`);
}

/**
 * Retorna a URL base do backend
 */
export function getBackendUrl(): string {
  return BACKEND_URL;
}

// Setup global do Vitest
beforeAll(async () => {
  await startPythonBackend();
}, 180000);

afterAll(async () => {
  await stopPythonBackend();
}, 30000);
