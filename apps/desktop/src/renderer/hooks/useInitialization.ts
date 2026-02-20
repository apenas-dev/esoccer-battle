/**
 * useInitialization Hook
 * Manages app initialization state including first run detection and loading
 * Follows SOLID + KISS + camelCase
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { TerminalLine } from '../components/TerminalOutput';
import { DownloadProgress } from '../components/DownloadScreen';
import { LoadingProgress } from '../components/LoadingScreen';

export type InitializationState = 'checking' | 'downloading' | 'loading' | 'ready' | 'error';

interface UseInitializationReturn {
  state: InitializationState;
  downloadProgress: DownloadProgress;
  loadingProgress: LoadingProgress;
  terminalLines: TerminalLine[];
  error: string | null;
  retry: () => void;
  restart: () => void;
}

/**
 * Generate unique ID for terminal lines
 */
function generateLineId(): string {
  return `line-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Hook to manage initialization flow
 */
export function useInitialization(): UseInitializationReturn {
  const [state, setState] = useState<InitializationState>('checking');
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({
    stage: 'checking',
    percentage: 0,
    message: 'Verificando sistema...',
  });
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress>({
    stage: 'backend',
    percentage: 0,
    message: 'Iniciando...',
  });
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isInitializedRef = useRef(false);

  /**
   * Add a line to the terminal output
   */
  const addTerminalLine = useCallback((text: string, type: TerminalLine['type'] = 'info') => {
    setTerminalLines((prev) => [
      ...prev,
      { id: generateLineId(), text, type, timestamp: new Date() },
    ]);
  }, []);

  /**
   * Start the download process
   */
  const startDownload = useCallback(async () => {
    if (!window.esoccerApi) {
      setError('API não disponível');
      setState('error');
      return;
    }

    setTerminalLines([]);
    addTerminalLine('Iniciando processo de download...', 'command');
    
    // Subscribe to progress events
    unsubscribeRef.current = window.esoccerApi.onDownloadProgress((event) => {
      setDownloadProgress({
        stage: event.stage,
        percentage: event.percentage,
        message: event.message,
      });
      
      // Add terminal line based on stage
      if (event.stage === 'checking') {
        addTerminalLine(event.message, 'info');
      } else if (event.stage === 'dependencies') {
        addTerminalLine(event.message, 'info');
      } else if (event.stage === 'whisper') {
        addTerminalLine(event.message, 'info');
      } else if (event.stage === 'kokoro') {
        addTerminalLine(event.message, 'info');
      } else if (event.stage === 'complete') {
        addTerminalLine(event.message, 'success');
        setState('loading');
      } else if (event.stage === 'error') {
        addTerminalLine(event.message, 'error');
        setError(event.message);
        setState('error');
      }
    });

    // Start the download
    const result = await window.esoccerApi.startDownload();
    
    if (result.success) {
      addTerminalLine('Download concluído com sucesso!', 'success');
      // Move to loading state
      startLoading();
    } else {
      addTerminalLine(`Erro: ${result.error}`, 'error');
      setError(result.error || 'Erro desconhecido');
      setDownloadProgress((prev) => ({ ...prev, stage: 'error' }));
      setState('error');
    }
  }, [addTerminalLine]);

  /**
   * Start the loading process (for subsequent runs)
   */
  const startLoading = useCallback(async () => {
    setState('loading');
    setLoadingProgress({
      stage: 'backend',
      percentage: 0,
      message: 'Iniciando backend Python...',
    });

    if (!window.esoccerApi) {
      setError('API não disponível');
      setState('error');
      return;
    }

    // Poll for backend readiness
    const maxAttempts = 60; // 60 seconds total
    let attempts = 0;

    const checkReady = async (): Promise<boolean> => {
      try {
        const result = await window.esoccerApi!.checkBackendReady();
        return result.ready;
      } catch {
        return false;
      }
    };

    // Update progress during loading
    const progressInterval = setInterval(() => {
      attempts++;
      const percentage = Math.min(90, Math.floor((attempts / maxAttempts) * 90));
      
      if (percentage < 20) {
        setLoadingProgress({
          stage: 'backend',
          percentage,
          message: 'Iniciando backend...',
        });
      } else if (percentage < 50) {
        setLoadingProgress({
          stage: 'stt',
          percentage,
          message: 'Carregando modelo STT (Whisper)...',
        });
      } else if (percentage < 80) {
        setLoadingProgress({
          stage: 'tts',
          percentage,
          message: 'Carregando modelo TTS (Kokoro)...',
        });
      } else {
        setLoadingProgress({
          stage: 'finalizing',
          percentage,
          message: 'Finalizando...',
        });
      }
    }, 1000);

    // Wait for backend to be ready
    while (attempts < maxAttempts) {
      const isReady = await checkReady();
      if (isReady) {
        clearInterval(progressInterval);
        setLoadingProgress({
          stage: 'ready',
          percentage: 100,
          message: 'Sistema pronto!',
        });
        setState('ready');
        return;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    clearInterval(progressInterval);
    setError('Timeout ao aguardar o backend. Tente reiniciar o aplicativo.');
    setLoadingProgress({
      stage: 'error',
      percentage: 0,
      message: 'Falha ao iniciar backend',
    });
    setState('error');
  }, []);

  /**
   * Retry download
   */
  const retry = useCallback(() => {
    setError(null);
    setTerminalLines([]);
    setDownloadProgress({
      stage: 'checking',
      percentage: 0,
      message: 'Tentando novamente...',
    });
    setState('downloading');
    startDownload();
  }, [startDownload]);

  /**
   * Restart loading
   */
  const restart = useCallback(async () => {
    setError(null);
    setLoadingProgress({
      stage: 'backend',
      percentage: 0,
      message: 'Reiniciando...',
    });
    setState('loading');

    if (window.esoccerApi) {
      await window.esoccerApi.restartBackend();
    }
    
    startLoading();
  }, [startLoading]);

  /**
   * Initial check on mount
   */
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const initialize = async () => {
      if (!window.esoccerApi) {
        // Wait a bit for API to be available
        await new Promise((r) => setTimeout(r, 500));
        if (!window.esoccerApi) {
          setError('API não disponível. Reinicie o aplicativo.');
          setState('error');
          return;
        }
      }

      try {
        // Check if this is first run
        const { isFirstRun } = await window.esoccerApi.checkFirstRun();
        
        if (isFirstRun) {
          // First run - need to download models
          setState('downloading');
          startDownload();
        } else {
          // Subsequent run - just load
          startLoading();
        }
      } catch (err) {
        console.error('[useInitialization] Error checking first run:', err);
        // Default to loading state
        startLoading();
      }
    };

    initialize();

    // Cleanup
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [startDownload, startLoading]);

  // Subscribe to backend errors
  useEffect(() => {
    if (!window.esoccerApi) return;

    const unsubscribe = window.esoccerApi.onBackendError((errorMsg) => {
      setError(errorMsg);
      setState('error');
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    state,
    downloadProgress,
    loadingProgress,
    terminalLines,
    error,
    retry,
    restart,
  };
}
