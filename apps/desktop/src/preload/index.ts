/**
 * Preload Script - E-Soccer Battle
 * Exposes esoccerApi to renderer via contextBridge
 * Uses real SQLite stores and WebSpeech API (no Python backend required)
 * Follows SOLID + KISS + DIP + camelCase
 */

import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

// Core domain imports
import { Match } from '../core/entities/Match';
import { CommandEngine, CommandResult } from '../core/commands/CommandEngine';
import { SQLiteMatchStore, SQLiteCommandLogStore } from '../core/stores/sqlite';
import { InMemoryDoubtStore } from '../core/stores/InMemoryDoubtStore';
import { SetupError } from '../shared/SetupError';

console.log('[preload] Script starting...');

// Initialize stores (SQLite for persistence)
let matchStore: SQLiteMatchStore | null = null;
let commandLogStore: SQLiteCommandLogStore | null = null;
let doubtStore: InMemoryDoubtStore | null = null;
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
    return;
  }

  try {
    if (matchStore && doubtStore && commandLogStore) {
      console.log('[preload] Initializing Command Engine...');
      commandEngine = new CommandEngine({
        matchStore,
        doubtStore,
        commandLogStore,
      });
      console.log('[preload] Command Engine initialized');
    }
  } catch (error) {
    console.error('[preload] Failed to initialize Command Engine:', error);
    initializationError = initializationError || `Erro ao inicializar engine: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// Run initialization
initializeDependencies();

/**
 * E-Soccer API interface exposed to renderer
 */
interface EsoccerApi {
  // Health check
  getHealth: () => Promise<{ status: string; backend: string; initError?: string }>;

  // Match management
  getCurrentMatch: () => Promise<Match | null>;
  getMatchHistory: () => Promise<Match[]>;

  // Text command processing (voice commands are handled in renderer via WebSpeech)
  processTextCommand: (text: string) => Promise<CommandResult>;

  // Backend management (optional Python backend for future use)
  getBackendStatus: () => Promise<{ running: boolean; error: SetupError | null; url: string; logPath: string }>;
  getLogsPath: () => Promise<string>;
  openLogs: () => Promise<void>;
}

/**
 * Implementation of the E-Soccer API
 */
const esoccerApi: EsoccerApi = {
  /**
   * Check health — always returns online since no Python backend is required
   */
  getHealth: async () => {
    console.log('[preload] getHealth called');
    return {
      status: 'ok',
      backend: initializationError ? 'degraded' : 'online',
      initError: initializationError || undefined,
    };
  },

  /**
   * Get the current active match
   */
  getCurrentMatch: async () => {
    console.log('[preload] getCurrentMatch called');
    if (!matchStore) return null;
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
    if (!matchStore) return [];
    try {
      return await matchStore.getAllMatches();
    } catch (error) {
      console.error('[preload] getMatchHistory error:', error);
      return [];
    }
  },

  /**
   * Process a text command
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
   * Get backend status from main process (optional Python backend)
   */
  getBackendStatus: async () => {
    try {
      return await ipcRenderer.invoke('get-backend-status');
    } catch {
      return { running: false, error: null, url: '', logPath: '' };
    }
  },

  /**
   * Get the logs file path
   */
  getLogsPath: async () => {
    try {
      return await ipcRenderer.invoke('get-logs-path');
    } catch {
      return '';
    }
  },

  /**
   * Open logs folder
   */
  openLogs: async () => {
    try {
      await ipcRenderer.invoke('open-logs');
    } catch {
      // Ignore
    }
  },
};

// Expose APIs via contextBridge
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('esoccerApi', esoccerApi);
    console.log('[preload] APIs exposed successfully');
  } catch (error) {
    console.error('[preload] Failed to expose APIs:', error);
  }
} else {
  // @ts-ignore
  window.electron = electronAPI;
  // @ts-ignore
  window.esoccerApi = esoccerApi;
}

export type { EsoccerApi };
