/**
 * Preload Script - E-Soccer Battle
 * Exposes esoccerApi to renderer via contextBridge
 * Uses real SQLite stores and Python adapters
 * Follows SOLID + KISS + DIP + camelCase
 */

import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

// Core domain imports
import { Match } from '../core/entities/Match';
import { CommandEngine, CommandResult } from '../core/commands/CommandEngine';
import { SQLiteMatchStore, SQLiteCommandLogStore } from '../core/stores/sqlite';
import { InMemoryDoubtStore } from '../core/stores/InMemoryDoubtStore';
import { PythonVoiceTranscriberAdapter, PythonVoiceSynthesizerAdapter } from '../core/adapters/python';
import { SetupError } from '../shared/SetupError';

console.log('[preload] Script starting...');
console.log('[preload] __dirname:', __dirname);
console.log('[preload] process.cwd():', process.cwd());

const PYTHON_BACKEND_URL = 'http://127.0.0.1:8001';

// Initialize stores (SQLite for persistence)
let matchStore: SQLiteMatchStore | null = null;
let commandLogStore: SQLiteCommandLogStore | null = null;
let doubtStore: InMemoryDoubtStore | null = null;
let voiceTranscriber: PythonVoiceTranscriberAdapter | null = null;
let voiceSynthesizer: PythonVoiceSynthesizerAdapter | null = null;
let commandEngine: CommandEngine | null = null;
let initializationError: string | null = null;

/**
 * Initialize all dependencies with error handling
 */
function initializeDependencies(): void {
  try {
    console.log('[preload] Initializing stores...');
    matchStore = new SQLiteMatchStore();
    commandLogStore = new SQLiteCommandLogStore();
    doubtStore = new InMemoryDoubtStore();
    console.log('[preload] Stores initialized successfully');
  } catch (error) {
    console.error('[preload] Failed to initialize stores:', error);
    initializationError = `Erro ao inicializar banco de dados: ${error instanceof Error ? error.message : String(error)}`;
    // Continue with null stores - will use fallback behavior
  }

  try {
    // Initialize Python adapters
    console.log('[preload] Initializing Python adapters...');
    voiceTranscriber = new PythonVoiceTranscriberAdapter(PYTHON_BACKEND_URL);
    voiceSynthesizer = new PythonVoiceSynthesizerAdapter(PYTHON_BACKEND_URL);
    console.log('[preload] Python adapters initialized');
  } catch (error) {
    console.error('[preload] Failed to initialize Python adapters:', error);
    initializationError = initializationError || `Erro ao inicializar adaptadores: ${error instanceof Error ? error.message : String(error)}`;
  }

  try {
    // Initialize Command Engine with available dependencies
    if (matchStore && doubtStore && commandLogStore) {
      console.log('[preload] Initializing Command Engine...');
      commandEngine = new CommandEngine({
        matchStore,
        doubtStore,
        commandLogStore,
        voiceSynthesizer: voiceSynthesizer || undefined,
      });
      console.log('[preload] Command Engine initialized');
    } else {
      console.warn('[preload] Cannot initialize Command Engine - stores not available');
      initializationError = initializationError || 'Stores não inicializados corretamente';
    }
  } catch (error) {
    console.error('[preload] Failed to initialize Command Engine:', error);
    initializationError = initializationError || `Erro ao inicializar engine: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// Run initialization
initializeDependencies();

/**
 * Backend health response with details
 */
interface BackendHealthResponse {
  status: string;
  backend: 'online' | 'offline' | 'connecting';
  initError?: string;
  backendDetails?: {
    responseTime: number;
    url: string;
  };
}

/**
 * Backend status from main process
 */
interface BackendStatus {
  running: boolean;
  error: SetupError | null;
  url: string;
  logPath: string;
}

/**
 * First run check result
 */
interface FirstRunCheck {
  isFirstRun: boolean;
  modelsStatus: {
    whisperReady: boolean;
    kokoroReady: boolean;
    modelsDir: string;
  };
}

/**
 * Download progress event
 */
interface DownloadProgressEvent {
  stage: 'checking' | 'dependencies' | 'whisper' | 'kokoro' | 'finalizing' | 'complete' | 'error';
  percentage: number;
  message: string;
}

/**
 * E-Soccer API interface exposed to renderer
 */
interface EsoccerApi {
  // Health check
  getHealth: () => Promise<BackendHealthResponse>;

  // Voice control
  startListening: () => Promise<{ success: boolean }>;
  stopListening: () => Promise<{ success: boolean }>;
  processVoiceCommand: (audioBuffer: Float32Array) => Promise<CommandResult>;

  // Match management
  getCurrentMatch: () => Promise<Match | null>;
  getMatchHistory: () => Promise<Match[]>;

  // Text command (for testing/debugging)
  processTextCommand: (text: string) => Promise<CommandResult>;

  // TTS direct
  synthesizeSpeech: (text: string) => Promise<ArrayBuffer>;

  // Direct connection test
  testBackendConnection: () => Promise<{ success: boolean; message: string; responseTime?: number }>;

  // Backend management (via IPC to main process)
  getBackendStatus: () => Promise<BackendStatus>;
  restartBackend: () => Promise<{ success: boolean; setupError?: SetupError }>;
  getLogsPath: () => Promise<string>;
  openLogs: () => Promise<void>;

  // Initialization APIs (for download/loading screens)
  checkFirstRun: () => Promise<FirstRunCheck>;
  startDownload: () => Promise<{ success: boolean; setupError?: SetupError }>;
  checkBackendReady: () => Promise<{ ready: boolean; status: unknown }>;
  onDownloadProgress: (callback: (event: DownloadProgressEvent) => void) => () => void;
  onBackendError: (callback: (error: SetupError) => void) => () => void;
}

/**
 * Implementation of the E-Soccer API
 */
const esoccerApi: EsoccerApi = {
  /**
   * Check health of both Electron and Python backend
   */
  getHealth: async (): Promise<BackendHealthResponse> => {
    console.log('[preload] getHealth called');
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${PYTHON_BACKEND_URL}/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        console.log('[preload] Backend health check passed:', data, `(${responseTime}ms)`);
        return {
          status: 'ok',
          backend: 'online',
          initError: initializationError || undefined,
          backendDetails: {
            responseTime,
            url: PYTHON_BACKEND_URL,
          },
        };
      }

      console.warn('[preload] Backend returned non-ok status:', response.status);
      return {
        status: 'error',
        backend: 'offline',
        initError: initializationError || `Backend returned ${response.status}`,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[preload] Backend health check failed:', errorMessage, `(${responseTime}ms)`);

      return {
        status: 'error',
        backend: 'offline',
        initError: initializationError || `Não foi possível conectar ao backend: ${errorMessage}`,
      };
    }
  },

  /**
   * Test backend connection directly
   */
  testBackendConnection: async () => {
    console.log('[preload] testBackendConnection called');
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${PYTHON_BACKEND_URL}/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return {
          success: true,
          message: `Conectado ao backend em ${PYTHON_BACKEND_URL}`,
          responseTime,
        };
      }

      return {
        success: false,
        message: `Backend retornou status ${response.status}`,
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        message: `Falha na conexão: ${errorMessage}`,
        responseTime,
      };
    }
  },

  /**
   * Start listening for voice commands
   * Note: Actual microphone capture happens in renderer
   */
  startListening: async () => {
    console.log('[preload] startListening called');
    return { success: true };
  },

  /**
   * Stop listening for voice commands
   */
  stopListening: async () => {
    console.log('[preload] stopListening called');
    return { success: true };
  },

  /**
   * Process voice command from raw audio buffer (ArrayBuffer)
   * NOTE: ArrayBuffer may lose its type when passed through contextBridge
   * We need to restore it to ArrayBuffer if needed
   */
  processVoiceCommand: async (audioBuffer: ArrayBuffer | ArrayLike<number>) => {
    console.log('[preload] processVoiceCommand called');
    console.log('[preload] audioBuffer type:', Object.prototype.toString.call(audioBuffer));

    // Validate input exists
    if (!audioBuffer) {
      console.error('[preload] audioBuffer is null or undefined');
      return {
        success: false,
        commandId: 'unknown' as const,
        message: 'Nenhum áudio recebido. Tente gravar novamente.',
      };
    }

    // Get byteLength safely
    const byteLength = 'byteLength' in audioBuffer ? audioBuffer.byteLength : ('length' in audioBuffer ? audioBuffer.length : 0);
    console.log('[preload] audioBuffer byteLength/length:', byteLength);

    if (byteLength === 0) {
      console.error('[preload] audioBuffer is empty');
      return {
        success: false,
        commandId: 'unknown' as const,
        message: 'Áudio vazio recebido. Tente gravar novamente.',
      };
    }

    // Convert to ArrayBuffer if needed (contextBridge may convert to plain object/array)
    let finalBuffer: ArrayBuffer;

    if (audioBuffer instanceof ArrayBuffer) {
      finalBuffer = audioBuffer;
      console.log('[preload] audioBuffer is already ArrayBuffer');
    } else if (ArrayBuffer.isView(audioBuffer)) {
      // It's a typed array like Uint8Array, get its underlying buffer
      // Cast to ArrayBuffer as we know it's not a SharedArrayBuffer in this context
      finalBuffer = audioBuffer.buffer.slice(
        audioBuffer.byteOffset,
        audioBuffer.byteOffset + audioBuffer.byteLength
      ) as ArrayBuffer;
      console.log('[preload] Extracted ArrayBuffer from ArrayBufferView');
    } else if (Array.isArray(audioBuffer) || typeof audioBuffer === 'object') {
      try {
        const values = Object.values(audioBuffer) as number[];
        const uint8Array = new Uint8Array(values);
        finalBuffer = uint8Array.buffer;
        console.log('[preload] Converted object/array to ArrayBuffer (Uint8Array approach), size:', finalBuffer.byteLength);
      } catch (conversionError) {
        console.error('[preload] Failed to convert audioBuffer:', conversionError);
        return {
          success: false,
          commandId: 'unknown' as const,
          message: 'Erro ao processar formato do áudio.',
        };
      }
    } else {
      console.error('[preload] Unknown audioBuffer type:', typeof audioBuffer);
      return {
        success: false,
        commandId: 'unknown' as const,
        message: 'Formato de áudio inválido.',
      };
    }

    if (!voiceTranscriber || !commandEngine) {
      console.error('[preload] voiceTranscriber or commandEngine not initialized');
      return {
        success: false,
        commandId: 'unknown' as const,
        message: initializationError || 'Sistema não inicializado. Reinicie a aplicação.',
      };
    }

    try {
      console.log('[preload] Calling voiceTranscriber.transcribeAudio with byteLength:', finalBuffer.byteLength);
      // Transcribe audio to text
      const transcription = await voiceTranscriber.transcribeAudio(finalBuffer);
      console.log('[preload] Transcription result:', transcription);

      if (!transcription.text || transcription.text.trim() === '') {
        console.warn('[preload] Empty transcription received');
        return {
          success: false,
          commandId: 'unknown' as const,
          message: 'Não foi possível entender o áudio. Tente novamente.',
        };
      }

      console.log('[preload] Processing command:', transcription.text);
      // Process the transcribed text as a command
      const result = await commandEngine.processCommand(transcription.text);
      console.log('[preload] Command result:', result);
      return result;
    } catch (error) {
      console.error('[preload] processVoiceCommand error:', error);
      const errorMessage = error instanceof Error ? error.message : 'desconhecido';
      return {
        success: false,
        commandId: 'unknown' as const,
        message: `Erro ao processar comando: ${errorMessage}`,
      };
    }
  },

  /**
   * Get the current active match
   */
  getCurrentMatch: async () => {
    console.log('[preload] getCurrentMatch called');
    if (!matchStore) {
      console.warn('[preload] matchStore not initialized');
      return null;
    }
    try {
      return await matchStore.getCurrentMatch();
    } catch (error) {
      console.error('[preload] getCurrentMatch error:', error);
      return null;
    }
  },

  /**
   * Get match history
   */
  getMatchHistory: async () => {
    console.log('[preload] getMatchHistory called');
    if (!matchStore) {
      console.warn('[preload] matchStore not initialized');
      return [];
    }
    try {
      return await matchStore.getAllMatches();
    } catch (error) {
      console.error('[preload] getMatchHistory error:', error);
      return [];
    }
  },

  /**
   * Process a text command directly (for testing/debugging)
   */
  processTextCommand: async (text: string) => {
    console.log('[preload] processTextCommand called:', text);
    if (!commandEngine) {
      return {
        success: false,
        commandId: 'unknown' as const,
        message: initializationError || 'Sistema não inicializado. Reinicie a aplicação.',
      };
    }
    try {
      return await commandEngine.processCommand(text);
    } catch (error) {
      console.error('[preload] processTextCommand error:', error);
      return {
        success: false,
        commandId: 'unknown' as const,
        message: `Erro ao processar comando: ${error instanceof Error ? error.message : 'desconhecido'}`,
      };
    }
  },

  /**
   * Synthesize speech from text (returns WAV bytes)
   */
  synthesizeSpeech: async (text: string) => {
    console.log('[preload] synthesizeSpeech called:', text);
    if (!voiceSynthesizer) {
      throw new Error(initializationError || 'Sistema não inicializado. Reinicie a aplicação.');
    }
    try {
      return await voiceSynthesizer.synthesizeSpeechToWav(text);
    } catch (error) {
      console.error('[preload] synthesizeSpeech error:', error);
      throw error;
    }
  },

  /**
   * Get backend status from main process
   */
  getBackendStatus: async () => {
    console.log('[preload] getBackendStatus called');
    try {
      return await ipcRenderer.invoke('get-backend-status');
    } catch (error) {
      console.error('[preload] getBackendStatus error:', error);
      return {
        running: false,
        error: {
          code: 'UNKNOWN',
          category: 'system',
          message: `Erro ao obter status: ${error instanceof Error ? error.message : 'desconhecido'}`,
          recoveryActions: [{ id: 'restart_app', label: 'Reiniciar App', variant: 'primary' }],
        } as SetupError,
        url: PYTHON_BACKEND_URL,
        logPath: '',
      };
    }
  },

  /**
   * Restart the Python backend
   */
  restartBackend: async () => {
    console.log('[preload] restartBackend called');
    try {
      return await ipcRenderer.invoke('restart-backend');
    } catch (error) {
      console.error('[preload] restartBackend error:', error);
      return {
        success: false,
        setupError: {
          code: 'UNKNOWN',
          category: 'system',
          message: `Erro ao reiniciar: ${error instanceof Error ? error.message : 'desconhecido'}`,
          recoveryActions: [{ id: 'restart_app', label: 'Reiniciar App', variant: 'primary' }],
        } as SetupError,
      };
    }
  },

  /**
   * Get the logs file path
   */
  getLogsPath: async () => {
    console.log('[preload] getLogsPath called');
    try {
      return await ipcRenderer.invoke('get-logs-path');
    } catch (error) {
      console.error('[preload] getLogsPath error:', error);
      return '';
    }
  },

  /**
   * Open logs folder
   */
  openLogs: async () => {
    console.log('[preload] openLogs called');
    try {
      await ipcRenderer.invoke('open-logs');
    } catch (error) {
      console.error('[preload] openLogs error:', error);
    }
  },

  /**
   * Check if this is first run (models not downloaded)
   */
  checkFirstRun: async () => {
    console.log('[preload] checkFirstRun called');
    try {
      return await ipcRenderer.invoke('check-first-run');
    } catch (error) {
      console.error('[preload] checkFirstRun error:', error);
      return {
        isFirstRun: true,
        modelsStatus: { whisperReady: false, kokoroReady: false, modelsDir: '' },
      };
    }
  },

  /**
   * Start download process for models
   */
  startDownload: async () => {
    console.log('[preload] startDownload called');
    try {
      return await ipcRenderer.invoke('start-download');
    } catch (error) {
      console.error('[preload] startDownload error:', error);
      return {
        success: false,
        setupError: {
          code: 'UNKNOWN',
          category: 'system',
          message: `Erro ao iniciar download: ${error instanceof Error ? error.message : 'desconhecido'}`,
          recoveryActions: [{ id: 'restart_app', label: 'Reiniciar App', variant: 'primary' }],
        } as SetupError,
      };
    }
  },

  /**
   * Check if backend is ready
   */
  checkBackendReady: async () => {
    console.log('[preload] checkBackendReady called');
    try {
      return await ipcRenderer.invoke('check-backend-ready');
    } catch (error) {
      console.error('[preload] checkBackendReady error:', error);
      return { ready: false, status: null };
    }
  },

  /**
   * Subscribe to download progress events
   */
  onDownloadProgress: (callback: (event: DownloadProgressEvent) => void) => {
    console.log('[preload] onDownloadProgress subscribed');
    const handler = (_event: Electron.IpcRendererEvent, data: DownloadProgressEvent) => {
      callback(data);
    };
    ipcRenderer.on('download-progress', handler);
    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener('download-progress', handler);
    };
  },

  /**
   * Subscribe to backend error events
   */
  onBackendError: (callback: (error: SetupError) => void) => {
    console.log('[preload] onBackendError subscribed');
    const handler = (_event: Electron.IpcRendererEvent, error: SetupError) => {
      callback(error);
    };
    ipcRenderer.on('backend-error', handler);
    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener('backend-error', handler);
    };
  },
};

// Expose APIs via contextBridge
console.log('[preload] Exposing APIs, contextIsolated:', process.contextIsolated);

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('esoccerApi', esoccerApi);
    console.log('[preload] APIs exposed successfully via contextBridge');
  } catch (error) {
    console.error('[preload] Failed to expose APIs:', error);
  }
} else {
  console.log('[preload] Context not isolated, assigning to window directly');
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.esoccerApi = esoccerApi;
  console.log('[preload] APIs assigned to window');
}

// Export types for TypeScript
export type { EsoccerApi };
