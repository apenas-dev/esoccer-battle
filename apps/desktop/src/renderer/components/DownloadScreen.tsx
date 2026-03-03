/**
 * DownloadScreen Component
 * First-time execution screen with real terminal output and progress bar
 * Follows SOLID + KISS + camelCase
 */

import React from 'react';
import { TerminalOutput, TerminalLine } from './TerminalOutput';
import { SetupError, getErrorTitle, getCategoryIcon } from '../../shared/SetupError';

export interface DownloadProgress {
  stage: 'checking' | 'dependencies' | 'backend' | 'whisper' | 'kokoro' | 'finalizing' | 'complete' | 'error';
  percentage: number;
  message: string;
}

interface DownloadScreenProps {
  progress: DownloadProgress;
  terminalLines: TerminalLine[];
  error?: SetupError | null;
  onRetry?: () => void;
}

export function DownloadScreen({
  progress,
  terminalLines,
  error,
  onRetry,
}: DownloadScreenProps): React.ReactElement {
  const getStageLabel = (stage: DownloadProgress['stage']): string => {
    switch (stage) {
      case 'checking':
        return 'Verificando sistema...';
      case 'dependencies':
        return 'Instalando dependências Python...';
      case 'backend':
        return 'Iniciando backend Python...';
      case 'whisper':
        return 'Baixando modelo Whisper (~1GB)...';
      case 'kokoro':
        return 'Baixando modelo Kokoro (~300MB)...';
      case 'finalizing':
        return 'Finalizando instalação...';
      case 'complete':
        return 'Instalação completa!';
      case 'error':
        return 'Erro na instalação';
      default:
        return 'Processando...';
    }
  };

  const isError = progress.stage === 'error' || !!error;
  const isComplete = progress.stage === 'complete';

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-900/80 border-b border-blue-500/30 px-6 py-4">
        <div className="flex items-center justify-center">
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="text-blue-400">⚽ E-Soccer</span>
            <span className="text-white"> Battle</span>
            <span className="text-green-400 ml-2 text-lg">- Primeira Execução</span>
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-2xl space-y-6">
          {/* Status Message */}
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-white">
              {isError ? '❌ ' : isComplete ? '✅ ' : '🔄 '}
              {getStageLabel(progress.stage)}
            </h2>
            <p className="text-slate-400">{progress.message}</p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Progresso</span>
              <span className={`font-mono ${isError ? 'text-red-400' : 'text-green-400'}`}>
                {progress.percentage}%
              </span>
            </div>
            <div className="h-4 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ease-out ${isError
                    ? 'bg-gradient-to-r from-red-600 to-red-400'
                    : isComplete
                      ? 'bg-gradient-to-r from-green-600 to-green-400'
                      : 'bg-gradient-to-r from-blue-600 to-cyan-400 animate-pulse'
                  }`}
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            {/* Stage indicators */}
            <div className="flex justify-between text-xs text-slate-500">
              <span className={progress.percentage >= 10 ? 'text-green-400' : ''}>Sistema</span>
              <span className={progress.percentage >= 20 ? 'text-green-400' : ''}>Python</span>
              <span className={progress.percentage >= 60 ? 'text-green-400' : ''}>Whisper</span>
              <span className={progress.percentage >= 90 ? 'text-green-400' : ''}>Kokoro</span>
              <span className={progress.percentage >= 100 ? 'text-green-400' : ''}>Pronto</span>
            </div>
          </div>

          {/* Terminal Output */}
          <TerminalOutput
            lines={terminalLines}
            title="download-progress"
            maxHeight="250px"
          />

          {/* Error State */}
          {isError && (
            <div className="space-y-4">
              <div className="p-4 bg-red-900/30 border border-red-500/50 rounded-lg">
                <h3 className="text-red-400 font-semibold mb-2 flex items-center gap-2">
                  <span>{error ? getCategoryIcon(error.category) : '❗'}</span>
                  <span>{error ? getErrorTitle(error.code) : 'Erro durante a instalação'}</span>
                </h3>
                <p className="text-red-300 text-sm mt-1">{error?.message || progress.message}</p>
                {error?.details && (
                  <details className="mt-3">
                    <summary className="text-xs text-red-400/80 cursor-pointer hover:text-red-400 focus:outline-none">Ver detalhes técnicos</summary>
                    <pre className="mt-2 text-[10px] text-red-300/80 bg-red-950/50 p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-32">
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
                          onRetry?.();
                        }
                      }}
                      className={`${baseClasses} ${colorClasses}`}
                    >
                      {action.label}
                    </button>
                  );
                })}

                {(!error?.recoveryActions || error.recoveryActions.length === 0) && onRetry && (
                  <button
                    onClick={onRetry}
                    className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <span>🔄</span>
                    <span>Tentar Novamente</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Info Box */}
          {!isError && !isComplete && (
            <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
              <p className="text-blue-300 text-sm">
                <span className="font-semibold">ℹ️ Primeira execução:</span> Os modelos de IA serão
                baixados (~1.3GB total). Isso pode levar alguns minutos dependendo da sua conexão.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900/50 border-t border-slate-700/50 px-6 py-3">
        <div className="flex items-center justify-center text-sm text-slate-500">
          <span>E-Soccer Battle v0.1.0 • Download de Modelos</span>
        </div>
      </footer>
    </div>
  );
}
