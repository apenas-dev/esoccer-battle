/**
 * LoadingScreen — Dark theme loading with progress
 */

import React from 'react';
import { SetupError, getErrorTitle, getCategoryIcon } from '../../shared/SetupError';

export interface LoadingProgress {
  stage: 'backend' | 'stt' | 'tts' | 'finalizing' | 'ready' | 'error';
  percentage: number;
  message: string;
}

interface LoadingScreenProps {
  progress: LoadingProgress;
  error?: SetupError | null;
  onRestart?: () => void;
}

export function LoadingScreen({
  progress,
  error,
  onRestart,
}: LoadingScreenProps): React.ReactElement {
  const getStageLabel = (stage: LoadingProgress['stage']): string => {
    switch (stage) {
      case 'backend': return 'Iniciando backend...';
      case 'stt': return 'Carregando STT...';
      case 'tts': return 'Carregando TTS...';
      case 'finalizing': return 'Finalizando...';
      case 'ready': return 'Pronto!';
      case 'error': return 'Erro';
    }
  };

  const isError = progress.stage === 'error' || !!error;
  const isReady = progress.stage === 'ready';

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0F1A]">
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <div className="text-center space-y-4">
            <div className="text-6xl animate-bounce">⚽</div>
            <h1 className="text-3xl font-black tracking-tight">
              <span className="text-accent-blue">E-Soccer</span>{' '}
              <span className="text-slate-100">Battle</span>
            </h1>
          </div>

          {/* Spinner */}
          {!isError && !isReady && (
            <div className="flex justify-center">
              <div className="flex gap-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-3 h-3 bg-accent-blue rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Status */}
          <div className="text-center">
            <p className={`text-lg font-medium ${
              isError ? 'text-[#FF3B5C]' : isReady ? 'text-[#00FF87]' : 'text-slate-100'
            }`}>
              {isError ? '❌ ' : isReady ? '✅ ' : ''}
              {getStageLabel(progress.stage)}
            </p>
            <p className="text-slate-500 text-sm mt-1">{progress.message}</p>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="h-1.5 bg-[#1A2035] rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  isError ? 'bg-[#FF3B5C]' : isReady ? 'bg-[#00FF87]' : 'bg-accent-blue'
                }`}
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>Carregando...</span>
              <span className="font-mono">{progress.percentage}%</span>
            </div>
          </div>

          {/* Error */}
          {isError && (
            <div className="space-y-4">
              <div className="p-4 bg-[#FF3B5C]/10 border border-[#FF3B5C]/20 rounded-lg text-left">
                <h3 className="text-[#FF3B5C] font-semibold mb-2 flex items-center gap-2">
                  <span>{error ? getCategoryIcon(error.category) : '❗'}</span>
                  <span>{error ? getErrorTitle(error.code) : 'Erro'}</span>
                </h3>
                <p className="text-slate-400 text-sm">{error?.message || progress.message}</p>
              </div>
              <div className="flex gap-3">
                {error?.recoveryActions?.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => {
                      if (action.id === 'open_logs') {
                        window.esoccerApi?.openLogs?.();
                      } else {
                        onRestart?.();
                      }
                    }}
                    className={`flex-1 py-3 px-6 font-semibold rounded-xl transition-colors ${
                      action.variant === 'primary'
                        ? 'bg-accent-blue hover:bg-accent-blue/80 text-white'
                        : 'bg-[#1A2035] hover:bg-white/10 text-slate-200'
                    }`}
                  >
                    {action.label}
                  </button>
                ))}
                {(!error?.recoveryActions || error.recoveryActions.length === 0) && onRestart && (
                  <button
                    onClick={onRestart}
                    className="w-full py-3 px-6 bg-accent-blue hover:bg-accent-blue/80 text-white font-semibold rounded-xl transition-colors"
                  >
                    🔄 Reiniciar
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#131825] border-t border-white/[0.06] px-6 py-3">
        <div className="flex items-center justify-center text-xs text-slate-600">
          E-Soccer Battle v2.0
        </div>
      </footer>
    </div>
  );
}
