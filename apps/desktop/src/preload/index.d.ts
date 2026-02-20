/**
 * Type definitions for preload API
 */

import { ElectronAPI } from '@electron-toolkit/preload';
import { Match } from '../core/entities/Match';
import { CommandResult } from '../core/commands/CommandEngine';

interface BackendHealthResponse {
  status: string;
  backend: 'online' | 'offline' | 'connecting';
  initError?: string;
  backendDetails?: {
    responseTime: number;
    url: string;
  };
}

interface ConnectionTestResult {
  success: boolean;
  message: string;
  responseTime?: number;
}

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
}

declare global {
  interface Window {
    electron: ElectronAPI;
    esoccerApi: EsoccerApi;
  }
}
