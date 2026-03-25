/**
 * StatusBar — Compact horizontal status bar
 * Dark theme, sports broadcast style
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { Match } from '../../core/entities';
import { isApiAvailable } from '../hooks/apiHelper';

interface StatusBarProps {
  backendStatus: 'checking' | 'online' | 'offline';
  match: Match | null;
  onShowHistory?: () => void;
  speechSupported?: boolean;
}

export function StatusBar({
  backendStatus,
  match,
  onShowHistory,
  speechSupported = true,
}: StatusBarProps): React.ReactElement {
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const [isRetrying, setIsRetrying] = useState(false);

  // Calculate elapsed time for active match
  useEffect(() => {
    if (!match || match.status !== 'emAndamento') {
      setElapsedTime('00:00');
      return;
    }

    const calc = () => {
      const start = match.startedAt ? new Date(match.startedAt).getTime() : Date.now();
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      setElapsedTime(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    };

    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [match]);

  const handleRetry = useCallback(async () => {
    if (!isApiAvailable() || isRetrying) return;
    setIsRetrying(true);
    try {
      await window.esoccerApi!.testBackendConnection();
    } catch {
      // ignore
    } finally {
      setTimeout(() => setIsRetrying(false), 2000);
    }
  }, [isRetrying]);

  const statusColor = (ok: boolean, warn?: boolean) =>
    ok ? 'text-[#00FF87]' : warn ? 'text-yellow-400' : 'text-[#FF3B5C]';

  const matchStatusText = match
    ? match.status === 'emAndamento'
      ? 'Em jogo'
      : match.status === 'pausado'
        ? 'Intervalo'
        : match.status === 'encerrado'
          ? 'Encerrado'
          : 'Pronto'
    : 'Sem partida';

  return (
    <footer className="bg-[#131825] border-t border-white/[0.06] px-4 sm:px-6 py-1.5">
      <div className="flex items-center justify-between text-xs font-mono text-slate-500 gap-4">
        {/* Left: Status indicators */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Speech */}
          <span className="flex items-center gap-1">
            <span className={statusColor(speechSupported)}>🎤</span>
            <span className={statusColor(speechSupported)}>
              {speechSupported ? 'WebSpeech OK' : 'WebSpeech OFF'}
            </span>
          </span>

          <span className="text-slate-700">│</span>

          {/* Backend */}
          <span
            className={`flex items-center gap-1 cursor-pointer ${backendStatus === 'offline' ? 'hover:text-slate-400' : ''}`}
            onClick={backendStatus === 'offline' ? handleRetry : undefined}
          >
            <span className={statusColor(backendStatus === 'online', backendStatus === 'checking')}>📡</span>
            <span className={statusColor(backendStatus === 'online', backendStatus === 'checking')}>
              {backendStatus === 'online' ? 'Backend Online' : backendStatus === 'checking' ? 'Verificando...' : 'Offline'}
            </span>
            {backendStatus === 'offline' && <span className="text-[#FF3B5C]">(clique)</span>}
          </span>

          {/* Match status + timer */}
          {match && (
            <>
              <span className="text-slate-700">│</span>
              <span className="text-slate-400">{matchStatusText}</span>
              {match.status === 'emAndamento' && (
                <>
                  <span className="text-slate-700">│</span>
                  <span className="text-[#00FF87]">⏱ {elapsedTime}</span>
                </>
              )}
            </>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {onShowHistory && (
            <button
              onClick={onShowHistory}
              className="text-slate-600 hover:text-slate-300 transition-colors"
            >
              📊 Histórico
            </button>
          )}
          <span className="text-slate-700 hidden sm:inline">v2.0</span>
        </div>
      </div>
    </footer>
  );
}
