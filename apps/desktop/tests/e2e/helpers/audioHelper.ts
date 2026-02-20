/**
 * Audio Helper for E2E Tests
 * Provides functions to handle audio files for testing
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUDIO_ASSETS_PATH = path.resolve(__dirname, '../../../test-assets/audio');

/**
 * Audio file paths for different commands
 */
export const audioFiles = {
  volta6: path.join(AUDIO_ASSETS_PATH, 'volta-seis.wav'),
  resultado: path.join(AUDIO_ASSETS_PATH, 'resultado.wav'),
  intervalo: path.join(AUDIO_ASSETS_PATH, 'intervalo.wav'),
  duvida: path.join(AUDIO_ASSETS_PATH, 'duvida.wav'),
  encerrar: path.join(AUDIO_ASSETS_PATH, 'encerrar.wav'),
  confirmar: path.join(AUDIO_ASSETS_PATH, 'confirmar.wav'),
  comandos: path.join(AUDIO_ASSETS_PATH, 'comandos.wav'),
  testTone: path.join(AUDIO_ASSETS_PATH, 'test-tone.wav'),
};

/**
 * Read audio file as buffer
 */
export function readAudioFile(filePath: string): Buffer {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Audio file not found: ${filePath}`);
  }
  return fs.readFileSync(filePath);
}

/**
 * Read audio file as base64
 */
export function readAudioAsBase64(filePath: string): string {
  const buffer = readAudioFile(filePath);
  return buffer.toString('base64');
}

/**
 * Create FormData with audio file for API requests
 */
export function createAudioFormData(filePath: string): FormData {
  const buffer = readAudioFile(filePath);
  const blob = new Blob([buffer], { type: 'audio/wav' });
  const formData = new FormData();
  formData.append('audio', blob, path.basename(filePath));
  return formData;
}

/**
 * Get audio file path by command name
 */
export function getAudioPathForCommand(commandName: string): string {
  const mapping: Record<string, string> = {
    'volta6': audioFiles.volta6,
    'volta-seis': audioFiles.volta6,
    'resultado': audioFiles.resultado,
    'intervalo': audioFiles.intervalo,
    'duvida': audioFiles.duvida,
    'duvida-agora': audioFiles.duvida,
    'encerrar': audioFiles.encerrar,
    'confirmar': audioFiles.confirmar,
    'comandos': audioFiles.comandos,
    'comandos-voz': audioFiles.comandos,
  };

  const audioPath = mapping[commandName.toLowerCase()];
  if (!audioPath) {
    throw new Error(`No audio file mapped for command: ${commandName}`);
  }
  
  return audioPath;
}

/**
 * Verify audio file exists
 */
export function verifyAudioFileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * Get all available audio files
 */
export function listAvailableAudioFiles(): string[] {
  if (!fs.existsSync(AUDIO_ASSETS_PATH)) {
    return [];
  }
  return fs.readdirSync(AUDIO_ASSETS_PATH).filter(f => f.endsWith('.wav') || f.endsWith('.mp3'));
}
