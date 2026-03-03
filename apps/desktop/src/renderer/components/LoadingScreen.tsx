/**
 * LoadingScreen Component
 * Subsequent execution loading screen with progress bar
 * Follows SOLID + KISS + camelCase
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
      case 'backend':
        return 'Iniciando backend...';
      case 'stt':
        return 'Carregando modelo STT (Whisper)...';
      case 'tts':
        return 'Carregando modelo TTS (Kokoro)...';
      case 'finalizing':
        return 'Finalizando...';
      case 'ready':
        return 'Pronto!';
      case 'error':
        return 'Erro ao iniciar';
      default:
        return 'Carregando...';
    }
  };

  const isError = progress.stage === 'error' || !!error;
  const isReady = progress.stage === 'ready';

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Centered Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Logo and Title */}
          <div className="text-center space-y-4">
            <div className="text-6xl animate-bounce">⚽</div>
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="text-blue-400">E-Soccer</span>
              <span className="text-white"> Battle</span>
            </h1>
          </div>

          {/* Loading Animation */}
          {!isError && !isReady && (
            <div className="flex justify-center">
              <div className="flex space-x-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-3 h-3 bg-blue-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Status Message */}
          <div className="text-center">
            <p className={`text-lg font-medium ${isError ? 'text-red-400' : isReady ? 'text-green-400' : 'text-white'
              }`}>
              {isError ? '❌ ' : isReady ? '✅ ' : ''}
              {getStageLabel(progress.stage)}
            </p>
            <p className="text-slate-400 text-sm mt-1">{progress.message}</p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ease-out ${isError
                    ? 'bg-red-500'
                    : isReady
                      ? 'bg-green-500'
                      : 'bg-gradient-to-r from-blue-500 to-cyan-400'
                  }`}
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Carregando modelos...</span>
              <span className="font-mono">{progress.percentage}%</span>
            </div>
          </div>

          {/* Stage Progress */}
          <div className="flex justify-center gap-3">
            {[
              { id: 'backend', threshold: 20 },
              { id: 'stt', threshold: 50 },
              { id: 'tts', threshold: 80 },
              { id: 'ready', threshold: 100 },
            ].map((stage) => (
              <div
                key={stage.id}
                className={`w-2 h-2 rounded-full transition-colors ${progress.percentage >= stage.threshold
                    ? 'bg-green-400'
                    : 'bg-slate-600'
                  }`}
              />
            ))}
          </div>

          {/* Error State */}
          {isError && (
            <div className="space-y-4">
              <div className="p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-left">
                <h3 className="text-red-400 font-semibold mb-2 flex items-center gap-2">
                  <span>{error ? getCategoryIcon(error.category) : '❗'}</span>
                  <span>{error ? getErrorTitle(error.code) : 'Erro de Inicialização'}</span>
                </h3>
                <p className="text-red-300 text-sm mt-1">{error?.message || progress.message}</p>
                {error?.details && (
                  <details className="mt-3">
                    <summary className="text-xs text-red-400/80 cursor-pointer hover:text-red-400 focus:outline-none">Ver detalhes técnicos</summary>
                    <pre className="mt-2 text-[10px] text-red-300/80 bg-red-950/50 p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-32 text-left">
                      {error.details}
                    </pre>
                  </details>
                )}
              </div>

              <div className="flex gap-3 mt-4">
                {error?.recoveryActions?.map(action => {
                  const isPrimary = action.variant === 'primary';
                  const baseClasses = "py-3 px-6 font-semibold rounded-lg transition-colors flex-1 flex items-center justify-center gap-2";
                  const colorClasses = isPrimary
                    ? "bg-blue-600 hover:bg-blue-500 text-white"
                    : "bg-slate-700 hover:bg-slate-600 text-slate-200";

                  return (
                    <button
                      key={action.id}
                      onClick={() => {
                        if (action.id === 'open_logs') {
                          window.esoccerApi?.openLogs?.();
                        } else {
                          onRestart?.();
                        }
                      }}
                      className={`${baseClasses} ${colorClasses}`}
                    >
                      {action.label}
                    </button>
                  );
                })}

                {(!error?.recoveryActions || error.recoveryActions.length === 0) && onRestart && (
                  <button
                    onClick={onRestart}
                    className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <span>🔄</span>
                    <span>Reiniciar</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Tip */}
          {!isError && !isReady && (
            <p className="text-center text-slate-500 text-xs">
              💡 Isso pode levar 30+ segundos na primeira execução após reinício
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900/50 border-t border-slate-700/50 px-6 py-3">
        <div className="flex items-center justify-center text-sm text-slate-500">
          <span>E-Soccer Battle v0.1.0 • Carregando...</span>
        </div>
      </footer>
    </div>
  );
}
