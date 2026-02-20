/**
 * StatusBar Component
 * Shows backend status, match time, and system info
 * Follows KISS + camelCase
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { Match } from '../../core/entities';
import { isApiAvailable } from '../hooks/apiHelper';

interface StatusBarProps {
  backendStatus: 'checking' | 'online' | 'offline';
  match: Match | null;
  onShowHistory?: () => void;
}

export function StatusBar({ backendStatus, match, onShowHistory }: StatusBarProps): React.ReactElement {
  const [elapsedTime, setElapsedTime] = useState<string>('00:00');
  const [isRetrying, setIsRetrying] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [logsPath, setLogsPath] = useState<string>('');

  // Calculate elapsed time for active match
  useEffect(() => {
    if (!match || match.status !== 'emAndamento') {
      setElapsedTime('00:00');
      return;
    }

    const calculateElapsed = () => {
      const startTime = match.startedAt ? new Date(match.startedAt).getTime() : Date.now();
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      setElapsedTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    calculateElapsed();
    const interval = setInterval(calculateElapsed, 1000);
    return () => clearInterval(interval);
  }, [match]);

  // Fetch backend status details when offline
  useEffect(() => {
    if (backendStatus === 'offline' && isApiAvailable()) {
      window.esoccerApi!.getBackendStatus().then((status) => {
        setBackendError(status.error);
        setLogsPath(status.logPath);
      }).catch(() => {
        // Ignore errors
      });
    } else if (backendStatus === 'online') {
      setBackendError(null);
    }
  }, [backendStatus]);

  // Handle retry connection
  const handleRetryConnection = useCallback(async () => {
    if (!isApiAvailable()) {
      setStatusMessage('API não disponível');
      return;
    }

    setIsRetrying(true);
    setStatusMessage('Testando conexão...');

    try {
      const result = await window.esoccerApi!.testBackendConnection();
      if (result.success) {
        setStatusMessage(`✅ ${result.message} (${result.responseTime}ms)`);
        setBackendError(null);
      } else {
        setStatusMessage(`❌ ${result.message}`);
      }
    } catch (error) {
      setStatusMessage(`❌ Erro: ${error instanceof Error ? error.message : 'Desconhecido'}`);
    } finally {
      setIsRetrying(false);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  }, []);

  // Handle restart backend
  const handleRestartBackend = useCallback(async () => {
    if (!isApiAvailable()) {
      setStatusMessage('API não disponível');
      return;
    }

    setIsRestarting(true);
    setStatusMessage('🔄 Reiniciando backend...');

    try {
      const result = await window.esoccerApi!.restartBackend();
      if (result.success) {
        setStatusMessage('✅ Backend reiniciado! Aguardando conexão...');
        setBackendError(null);
        // Give it a moment to connect
        setTimeout(handleRetryConnection, 2000);
      } else {
        setStatusMessage(`❌ Falha ao reiniciar: ${result.error}`);
        setBackendError(result.error);
      }
    } catch (error) {
      setStatusMessage(`❌ Erro: ${error instanceof Error ? error.message : 'Desconhecido'}`);
    } finally {
      setIsRestarting(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  }, [handleRetryConnection]);

  return (
    <footer className="bg-slate-900/80 border-t border-slate-700/50 px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Left: Backend Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                backendStatus === 'online'
                  ? 'bg-green-500 animate-pulse'
                  : backendStatus === 'offline'
                  ? 'bg-red-500'
                  : 'bg-yellow-500 animate-pulse'
              }`}
            />
            <span className="text-sm text-slate-400">
              Backend:{' '}
              <span
                className={`font-medium ${
                  backendStatus === 'online'
                    ? 'text-green-400'
                    : backendStatus === 'offline'
                    ? 'text-red-400'
                    : 'text-yellow-400'
                }`}
              >
                {backendStatus === 'online' ? 'Online' : backendStatus === 'offline' ? 'Offline' : 'Verificando...'}
              </span>
            </span>

            {/* Buttons when offline */}
            {backendStatus === 'offline' && (
              <div className="flex items-center gap-2 ml-2">
                <button
                  onClick={handleRetryConnection}
                  disabled={isRetrying || isRestarting}
                  className="px-2 py-0.5 text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 
                             rounded border border-blue-500/30 transition-colors disabled:opacity-50"
                >
                  {isRetrying ? '...' : '🔄 Reconectar'}
                </button>
                <button
                  onClick={handleRestartBackend}
                  disabled={isRetrying || isRestarting}
                  className="px-2 py-0.5 text-xs bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 
                             rounded border border-yellow-500/30 transition-colors disabled:opacity-50"
                >
                  {isRestarting ? '⏳ Reiniciando...' : '🚀 Reiniciar Backend'}
                </button>
              </div>
            )}

            {/* Status Message */}
            {statusMessage && (
              <span className="ml-2 text-xs text-slate-400">{statusMessage}</span>
            )}
          </div>

          {/* Match Timer */}
          {match && match.status === 'emAndamento' && (
            <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 rounded-full border border-green-500/30">
              <span className="text-green-400 text-sm">⏱️ {elapsedTime}</span>
              <span className="text-green-600 text-xs">/ 06:00</span>
            </div>
          )}
        </div>

        {/* Center: Version */}
        <p className="text-slate-600 text-sm">
          E-Soccer Battle v0.1.0 • Iteração 3
        </p>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {onShowHistory && (
            <button
              onClick={onShowHistory}
              className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
            >
              📊 Histórico
            </button>
          )}
          <span className="text-slate-600 text-xs">
            STT: Whisper • TTS: Kokoro
          </span>
        </div>
      </div>

      {/* Connection Error Banner */}
      {backendStatus === 'offline' && (
        <div className="mt-2 px-3 py-2 bg-red-500/10 rounded border border-red-500/30 space-y-1">
          <p className="text-red-400 text-xs">
            ⚠️ Backend Python não está respondendo em <code className="bg-red-500/20 px-1 rounded">http://127.0.0.1:8001</code>.
          </p>
          {backendError && (
            <p className="text-red-300 text-xs bg-red-500/10 px-2 py-1 rounded font-mono">
              {backendError}
            </p>
          )}
          <p className="text-slate-500 text-xs">
            💡 Clique em "Reiniciar Backend" para tentar novamente, ou verifique se Python 3.8+ e as dependências estão instalados.
            {logsPath && (
              <span className="block mt-1">
                📁 Logs: <code className="bg-slate-700/50 px-1 rounded">{logsPath}</code>
              </span>
            )}
          </p>
        </div>
      )}
    </footer>
  );
}
