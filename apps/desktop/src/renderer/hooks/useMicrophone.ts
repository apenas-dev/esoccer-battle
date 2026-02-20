/**
 * useMicrophone Hook
 * Handles microphone capture for voice commands
 * Follows KISS + camelCase
 */

import { useState, useCallback, useRef } from 'react';

interface UseMicrophoneResult {
  isRecording: boolean;
  isStopping: boolean;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<ArrayBuffer | null>;
}

const SAMPLE_RATE = 16000;

export function useMicrophone(): UseMicrophoneResult {
  const [isRecording, setIsRecording] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const resolverRef = useRef<((value: ArrayBuffer | null) => void) | null>(null);
  const isStoppingRef = useRef(false); // Sync guard — closes race condition window of useState

  const cleanupRecording = useCallback(() => {
    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log('[useMicrophone] Track stopped:', track.kind);
      });
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);
    isStoppingRef.current = false;
    setIsStopping(false);
  }, []);

  const startRecording = useCallback(async () => {
    console.log('[useMicrophone] startRecording called');
    // Prevent starting while stopping (use ref for sync check)
    if (isStopping || isStoppingRef.current) {
      console.warn('[useMicrophone] Cannot start while stopping');
      return;
    }

    try {
      if (mediaRecorderRef.current) {
        if (mediaRecorderRef.current.state === 'recording') {
          console.warn('[useMicrophone] Already recording, ignoring');
          return;
        }
        cleanupRecording();
      }

      setError(null);
      chunksRef.current = [];

      console.log('[useMicrophone] Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Check supported MIME types
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/ogg';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = ''; // Let browser choose
          }
        }
      }
      console.log('[useMicrophone] Using MIME type:', mimeType || 'default');

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
          console.log('[useMicrophone] Chunk received, size:', event.data.size);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('[useMicrophone] MediaRecorder error:', event);
        setError('Erro no gravador de áudio');
        cleanupRecording();
        if (resolverRef.current) {
          resolverRef.current(null);
          resolverRef.current = null;
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('[useMicrophone] MediaRecorder stopped, chunks:', chunksRef.current.length);

        try {
          // Validate chunks
          if (chunksRef.current.length === 0) {
            console.warn('[useMicrophone] No audio chunks recorded');
            if (resolverRef.current) {
              resolverRef.current(null);
              resolverRef.current = null;
            }
            return;
          }

          const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
          console.log('[useMicrophone] Created blob, size:', blob.size, 'type:', blob.type);

          // Validate blob size
          if (blob.size < 100) {
            console.warn('[useMicrophone] Blob too small, likely empty recording');
            if (resolverRef.current) {
              resolverRef.current(null);
              resolverRef.current = null;
            }
            return;
          }

          const audioBuffer = await blob.arrayBuffer();
          console.log('[useMicrophone] Extracted ArrayBuffer, bytes:', audioBuffer?.byteLength || 0);

          if (resolverRef.current) {
            resolverRef.current(audioBuffer);
            resolverRef.current = null;
          }
        } catch (err) {
          console.error('[useMicrophone] Error processing audio in onstop:', err);
          setError('Erro ao processar áudio gravado');
          if (resolverRef.current) {
            resolverRef.current(null);
            resolverRef.current = null;
          }
        } finally {
          // Always cleanup
          cleanupRecording();
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);

      console.log('[useMicrophone] Recording started');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao acessar microfone';
      setError(message);
      console.error('[useMicrophone] Error starting recording:', err);
      cleanupRecording();
    }
  }, [isStopping, cleanupRecording]);

  const stopRecording = useCallback(async (): Promise<ArrayBuffer | null> => {
    console.log('[useMicrophone] stopRecording called');

    // Prevent double stop calls (ref for sync, state for UI)
    if (isStoppingRef.current) {
      console.warn('[useMicrophone] Already stopping, ignoring duplicate call');
      return null;
    }

    isStoppingRef.current = true;
    setIsStopping(true);

    return new Promise((resolve) => {
      try {
        if (!mediaRecorderRef.current) {
          console.warn('[useMicrophone] No mediaRecorder to stop');
          isStoppingRef.current = false;
          setIsStopping(false);
          resolve(null);
          return;
        }

        if (mediaRecorderRef.current.state === 'inactive') {
          console.warn('[useMicrophone] MediaRecorder already inactive');
          isStoppingRef.current = false;
          setIsStopping(false);
          resolve(null);
          return;
        }

        // Set resolver — will be called by onstop handler
        resolverRef.current = (value) => {
          isStoppingRef.current = false;
          setIsStopping(false);
          resolve(value);
        };

        // Set a timeout to prevent hanging forever
        const timeoutId = setTimeout(() => {
          console.warn('[useMicrophone] Stop timeout reached (5s)');
          if (resolverRef.current) {
            resolverRef.current(null);
            resolverRef.current = null;
          }
          cleanupRecording();
        }, 5000);

        // Wrap resolver to clear timeout when onstop fires
        const wrappedResolver = resolverRef.current;
        resolverRef.current = (value) => {
          clearTimeout(timeoutId);
          wrappedResolver(value);
        };

        mediaRecorderRef.current.stop();
        console.log('[useMicrophone] MediaRecorder.stop() called');
      } catch (err) {
        console.error('[useMicrophone] Error in stopRecording:', err);
        cleanupRecording();
        resolve(null);
      }
    });
  }, [cleanupRecording]);

  return {
    isRecording,
    isStopping,
    error,
    startRecording,
    stopRecording,
  };
}
