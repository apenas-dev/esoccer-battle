/**
 * useInitialization Hook
 * Manages app initialization state
 * With WebSpeech, no Python backend is required — init goes straight to ready
 * Follows SOLID + KISS + camelCase
 */

import { useState, useEffect } from 'react';
import { SetupError, createSetupError } from '../../shared/SetupError';

export type InitializationState = 'checking' | 'ready' | 'error';

interface UseInitializationReturn {
  state: InitializationState;
  error: SetupError | null;
  retry: () => void;
  restart: () => void;
  retryCount: number;
}

/**
 * Hook to manage initialization flow
 * With WebSpeech STT and no Python backend, the app is ready as soon as
 * the preload initializes the CommandEngine.
 */
export function useInitialization(): UseInitializationReturn {
  const [state, setState] = useState<InitializationState>('checking');
  const [error, setError] = useState<SetupError | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const initialize = async () => {
      try {
        // Wait briefly for API to be available
        await new Promise((r) => setTimeout(r, 300));

        if (!window.esoccerApi) {
          setError(createSetupError('UNKNOWN', 'API não disponível. Reinicie o aplicativo.', undefined, false));
          setState('error');
          return;
        }

        // Check health — if preload stores initialized correctly, we're good
        const health = await window.esoccerApi.getHealth();
        if (health.initError) {
          console.warn('[useInitialization] Init warning:', health.initError);
          // Still proceed — degraded mode
        }

        setState('ready');
      } catch (err) {
        console.error('[useInitialization] Error:', err);
        setError(createSetupError(
          'UNKNOWN',
          err instanceof Error ? err.message : 'Erro na inicialização',
          undefined,
          false
        ));
        setState('error');
      }
    };

    initialize();
  }, []);

  const retry = () => {
    setRetryCount((prev) => prev + 1);
    setError(null);
    setState('checking');
    // Re-trigger by re-mounting — caller should handle this
    setTimeout(() => setState('ready'), 500);
  };

  const restart = retry;

  return {
    state,
    error,
    retry,
    restart,
    retryCount,
  };
}
