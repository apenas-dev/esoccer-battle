/**
 * Global type definitions for renderer process
 * E-Soccer Battle
 */

import { ElectronAPI } from '@electron-toolkit/preload';
import { SetupError } from '../shared/SetupError';

// Match entity (simplified for renderer)
interface Match {
  id: string;
  status: 'aguardando' | 'emAndamento' | 'pausado' | 'encerrado';
  scoreA: number;
  scoreB: number;
  durationMinutes: number;
  startedAt: Date | null;
  endedAt: Date | null;
}

// Command result from engine
interface CommandResult {
  success: boolean;
  commandId: string;
  message: string;
  audioResponse?: Float32Array;
  data?: unknown;
}

// Backend health response with details
interface BackendHealthResponse {
  status: string;
  backend: 'online' | 'offline' | 'connecting';
  initError?: string;
  backendDetails?: {
    responseTime: number;
    url: string;
  };
}

// Connection test result
interface ConnectionTestResult {
  success: boolean;
  message: string;
  responseTime?: number;
}

// Backend status from main process
interface BackendStatus {
  running: boolean;
  error: SetupError | null;
  url: string;
  logPath: string;
}

// First run check result
interface FirstRunCheck {
  isFirstRun: boolean;
  modelsStatus: {
    whisperReady: boolean;
    kokoroReady: boolean;
    modelsDir: string;
  };
}

// Download progress event
interface DownloadProgressEvent {
  stage: 'checking' | 'dependencies' | 'backend' | 'whisper' | 'kokoro' | 'finalizing' | 'complete' | 'error';
  percentage: number;
  message: string;
}

// E-Soccer API exposed via contextBridge
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
  testBackendConnection: () => Promise<ConnectionTestResult>;

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

declare global {
  interface Window {
    electron?: ElectronAPI;
    esoccerApi?: EsoccerApi;
  }
}

export { };
