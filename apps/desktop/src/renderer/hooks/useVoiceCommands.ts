/**
 * useVoiceCommands Hook
 * Processes voice commands and manages TTS playback
 * Follows KISS + camelCase
 */

import { useState, useCallback } from 'react';
import { isApiAvailable, API_NOT_AVAILABLE_MESSAGE } from './apiHelper';

interface CommandResult {
  success: boolean;
  commandId: string;
  message: string;
  audioResponse?: Float32Array;
}

interface UseVoiceCommandsResult {
  lastTranscription: string | null;
  lastResponse: string | null;
  isProcessing: boolean;
  error: string | null;
  processVoiceCommand: (audioBuffer: ArrayBuffer | null) => Promise<CommandResult | null>;
  processTextCommand: (text: string) => Promise<CommandResult | null>;
  speakText: (text: string) => Promise<void>;
}

export function useVoiceCommands(): UseVoiceCommandsResult {
  const [lastTranscription, setLastTranscription] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processVoiceCommand = useCallback(async (audioBuffer: ArrayBuffer | null): Promise<CommandResult | null> => {
    console.log('[useVoiceCommands] processVoiceCommand called');
    console.log('[useVoiceCommands] audioBuffer type:', audioBuffer ? Object.prototype.toString.call(audioBuffer) : 'null');
    console.log('[useVoiceCommands] audioBuffer byteLength:', audioBuffer ? audioBuffer.byteLength : 'N/A');

    // Validate audio buffer first
    if (!audioBuffer) {
      console.warn('[useVoiceCommands] audioBuffer is null or undefined');
      setError('Nenhum áudio capturado. Tente novamente.');
      return null;
    }

    const bufferLength = audioBuffer.byteLength;
    if (bufferLength === 0) {
      console.warn('[useVoiceCommands] Empty audio buffer');
      setError('Nenhum áudio capturado. Tente novamente.');
      return null;
    }

    // Check minimum audio length (rough estimate for WebM bytes)
    if (bufferLength < 1000) {
      console.warn('[useVoiceCommands] Audio too short:', bufferLength, 'bytes');
      setError('Áudio muito curto. Fale por mais tempo.');
      return null;
    }

    // Check if API is available
    if (!isApiAvailable()) {
      setError(API_NOT_AVAILABLE_MESSAGE);
      console.warn('[useVoiceCommands] API not available');
      return null;
    }

    setIsProcessing(true);
    setError(null);

    try {
      console.log('[useVoiceCommands] Calling window.esoccerApi.processVoiceCommand with', bufferLength, 'bytes');

      const result = await window.esoccerApi!.processVoiceCommand(audioBuffer as any);

      console.log('[useVoiceCommands] Result received:', JSON.stringify(result));
      setLastTranscription(result.message);
      setLastResponse(result.message);

      // Play audio response if available
      if (result.audioResponse && result.audioResponse.length > 0) {
        try {
          console.log('[useVoiceCommands] Playing audio response...');
          await playAudio(result.audioResponse);
          console.log('[useVoiceCommands] Audio response played');
        } catch (audioErr) {
          console.error('[useVoiceCommands] Error playing audio response:', audioErr);
          // Don't fail the command if audio playback fails
        }
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao processar comando';
      console.error('[useVoiceCommands] Error processing voice command:', err);
      console.error('[useVoiceCommands] Error stack:', err instanceof Error ? err.stack : 'N/A');
      setError(message);
      return null;
    } finally {
      setIsProcessing(false);
      console.log('[useVoiceCommands] processVoiceCommand finished');
    }
  }, []);

  const processTextCommand = useCallback(async (text: string): Promise<CommandResult | null> => {
    console.log('[useVoiceCommands] processTextCommand called:', text);

    // Validate text
    if (!text || text.trim() === '') {
      setError('Comando vazio. Digite um comando.');
      return null;
    }

    // Check if API is available
    if (!isApiAvailable()) {
      setError(API_NOT_AVAILABLE_MESSAGE);
      console.warn('[useVoiceCommands] API not available');
      return null;
    }

    setIsProcessing(true);
    setError(null);
    setLastTranscription(text);

    try {
      const result = await window.esoccerApi!.processTextCommand(text);
      console.log('[useVoiceCommands] Text command result:', result);
      setLastResponse(result.message);

      // Play audio response
      if (result.audioResponse && result.audioResponse.length > 0) {
        try {
          await playAudio(result.audioResponse);
        } catch (audioErr) {
          console.error('[useVoiceCommands] Error playing audio response:', audioErr);
        }
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao processar comando';
      console.error('[useVoiceCommands] Error:', err);
      setError(message);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const speakText = useCallback(async (text: string): Promise<void> => {
    console.log('[useVoiceCommands] speakText called:', text);

    if (!text || text.trim() === '') {
      console.warn('[useVoiceCommands] Empty text for TTS');
      return;
    }

    // Check if API is available
    if (!isApiAvailable()) {
      console.warn('[useVoiceCommands] API not available for TTS');
      return;
    }

    try {
      const wavBuffer = await window.esoccerApi!.synthesizeSpeech(text);
      if (wavBuffer && wavBuffer.byteLength > 0) {
        await playWavBuffer(wavBuffer);
      } else {
        console.warn('[useVoiceCommands] Empty WAV buffer received');
      }
    } catch (err) {
      console.error('[useVoiceCommands] TTS Error:', err);
      // Don't set error state for TTS failures - it's not critical
    }
  }, []);

  return {
    lastTranscription,
    lastResponse,
    isProcessing,
    error,
    processVoiceCommand,
    processTextCommand,
    speakText,
  };
}

/**
 * Play Float32Array audio through Web Audio API with error handling
 */
async function playAudio(samples: Float32Array): Promise<void> {
  console.log('[playAudio] Playing', samples.length, 'samples');

  if (!samples || samples.length === 0) {
    console.warn('[playAudio] Empty samples array');
    return;
  }

  let audioContext: AudioContext | null = null;

  try {
    audioContext = new AudioContext({ sampleRate: 24000 }); // Kokoro uses 24kHz

    const audioBuffer = audioContext.createBuffer(1, samples.length, 24000);
    audioBuffer.getChannelData(0).set(samples);

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start();

    // Wait for playback to complete
    await new Promise<void>((resolve) => {
      source.onended = () => resolve();
      // Timeout fallback
      setTimeout(resolve, (samples.length / 24000 * 1000) + 500);
    });
  } catch (err) {
    console.error('[playAudio] Error:', err);
    throw err;
  } finally {
    if (audioContext) {
      try {
        await audioContext.close();
      } catch (closeErr) {
        console.warn('[playAudio] Error closing AudioContext:', closeErr);
      }
    }
  }
}

/**
 * Play WAV ArrayBuffer through Web Audio API with error handling
 */
async function playWavBuffer(wavBuffer: ArrayBuffer): Promise<void> {
  console.log('[playWavBuffer] Playing WAV buffer, size:', wavBuffer.byteLength);

  if (!wavBuffer || wavBuffer.byteLength === 0) {
    console.warn('[playWavBuffer] Empty WAV buffer');
    return;
  }

  let audioContext: AudioContext | null = null;

  try {
    audioContext = new AudioContext();

    const audioBuffer = await audioContext.decodeAudioData(wavBuffer.slice(0)); // Clone buffer

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start();

    // Wait for playback to complete
    await new Promise<void>((resolve) => {
      source.onended = () => resolve();
      // Timeout fallback
      setTimeout(resolve, (audioBuffer.duration * 1000) + 500);
    });
  } catch (err) {
    console.error('[playWavBuffer] Error:', err);
    throw err;
  } finally {
    if (audioContext) {
      try {
        await audioContext.close();
      } catch (closeErr) {
        console.warn('[playWavBuffer] Error closing AudioContext:', closeErr);
      }
    }
  }
}
