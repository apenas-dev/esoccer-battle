/**
 * Type definitions for preload API
 */

import { ElectronAPI } from '@electron-toolkit/preload';
import { Match } from '../core/entities/Match';
import { CommandResult } from '../core/commands/CommandEngine';
import { SetupError } from '../shared/SetupError';

interface BackendHealthResponse {
  status: string;
  backend: 'online' | 'degraded' | 'offline';
  initError?: string;
}

interface BackendStatus {
  running: boolean;
  error: SetupError | null;
  url: string;
  logPath: string;
}

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

export { EsoccerApi };
