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
  data?: unknown;
}

// Backend health response
interface BackendHealthResponse {
  status: string;
  backend: 'online' | 'degraded' | 'offline';
  initError?: string;
}

// Backend status from main process
interface BackendStatus {
  running: boolean;
  error: SetupError | null;
  url: string;
  logPath: string;
}

// E-Soccer API exposed via contextBridge
interface EsoccerApi {
  // Health check
  getHealth: () => Promise<BackendHealthResponse>;

  // Match management
  getCurrentMatch: () => Promise<Match | null>;
  getMatchHistory: () => Promise<Match[]>;

  // Text command processing
  processTextCommand: (text: string) => Promise<CommandResult>;

  // Optional backend management
  getBackendStatus: () => Promise<BackendStatus>;
  getLogsPath: () => Promise<string>;
  openLogs: () => Promise<void>;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
    esoccerApi?: EsoccerApi;
  }
}

export {};
