/**
 * useVoiceCommands Hook
 * Processes voice commands via WebSpeech API and text commands
 * Follows KISS + camelCase
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { WebSpeechTranscriber } from '../speech/WebSpeechTranscriber';

interface CommandResult {
  success: boolean;
  commandId: string;
  message: string;
}

interface UseVoiceCommandsResult {
  lastTranscription: string | null;
  lastResponse: string | null;
  isProcessing: boolean;
  isListening: boolean;
  error: string | null;
  speechSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  processTextCommand: (text: string) => Promise<CommandResult | null>;
}

export function useVoiceCommands(): UseVoiceCommandsResult {
  const [lastTranscription, setLastTranscription] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transcriberRef = useRef<WebSpeechTranscriber | null>(null);
  const finalTextRef = useRef<string>('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const DEBOUNCE_MS = 1500; // Wait 1.5s after final result before processing

  // Initialize transcriber once
  useEffect(() => {
    transcriberRef.current = new WebSpeechTranscriber();
    return () => {
      transcriberRef.current?.stopListening();
    };
  }, []);

  const processTranscribedText = useCallback(async (text: string) => {
    if (!text.trim()) return;

    setIsProcessing(true);
    setError(null);
    setLastTranscription(text);

    try {
      const result = await window.esoccerApi!.processTextCommand(text);
      setLastResponse(result.message);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao processar comando';
      console.error('[useVoiceCommands] Error:', err);
      setError(message);
    } finally {
      setIsProcessing(false);
      finalTextRef.current = '';
    }
  }, []);

  const handleSpeechResult = useCallback((text: string, isFinal: boolean) => {
    console.log('[useVoiceCommands] Speech result:', { text, isFinal });

    if (isFinal) {
      finalTextRef.current += (finalTextRef.current ? ' ' : '') + text;

      // Reset debounce timer on each final result
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        if (finalTextRef.current.trim()) {
          processTranscribedText(finalTextRef.current);
        }
      }, DEBOUNCE_MS);
    }
  }, [processTranscribedText]);

  const handleSpeechError = useCallback((err: Error) => {
    console.error('[useVoiceCommands] Speech error:', err);
    setError(err.message);
  }, []);

  const startListening = useCallback(() => {
    if (!transcriberRef.current) return;

    setError(null);
    finalTextRef.current = '';

    transcriberRef.current.startListening({
      onResult: handleSpeechResult,
      onError: handleSpeechError,
    });
    setIsListening(true);
  }, [handleSpeechResult, handleSpeechError]);

  const stopListening = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Process any accumulated text immediately
    if (finalTextRef.current.trim()) {
      processTranscribedText(finalTextRef.current);
    }

    transcriberRef.current?.stopListening();
    setIsListening(false);
  }, [processTranscribedText]);

  const processTextCommand = useCallback(async (text: string): Promise<CommandResult | null> => {
    if (!text || text.trim() === '') {
      setError('Comando vazio. Digite um comando.');
      return null;
    }

    setIsProcessing(true);
    setError(null);
    setLastTranscription(text);

    try {
      const result = await window.esoccerApi!.processTextCommand(text);
      setLastResponse(result.message);
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

  const speechSupported = WebSpeechTranscriber.isSupported();

  return {
    lastTranscription,
    lastResponse,
    isProcessing,
    isListening,
    error,
    speechSupported,
    startListening,
    stopListening,
    processTextCommand,
  };
}
