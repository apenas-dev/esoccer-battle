/**
 * CommandHistory Component
 * Shows command history for current match
 * Follows KISS + camelCase
 */

import React from 'react';

interface CommandEntry {
  input: string;
  response: string;
  timestamp: Date;
}

interface CommandHistoryProps {
  commands: CommandEntry[];
  lastTranscription?: string;
  lastResponse?: string;
  onSpeak?: (text: string) => void;
}

export function CommandHistory({
  commands,
  lastTranscription,
  lastResponse,
  onSpeak,
}: CommandHistoryProps): React.ReactElement {
  const hasContent = lastTranscription || lastResponse || commands.length > 0;

  return (
    <section className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
      <h2 className="text-lg font-semibold text-slate-300 mb-4">📝 Histórico de Comandos</h2>

      {!hasContent ? (
        <div className="text-center py-6">
          <p className="text-slate-500 italic">Nenhum comando detectado ainda...</p>
          <p className="text-slate-600 text-sm mt-2">Use comandos de voz ou texto para interagir</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {/* Last Command (highlighted) */}
          {(lastTranscription || lastResponse) && (
            <div className="bg-slate-900/70 rounded-lg p-4 border border-blue-500/30">
              {lastTranscription && (
                <div className="mb-2">
                  <p className="text-xs text-slate-500 mb-1">🎤 Entrada:</p>
                  <p className="text-white font-mono text-sm">"{lastTranscription}"</p>
                </div>
              )}
              {lastResponse && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">🤖 Resposta:</p>
                  <p className="text-green-400 font-mono text-sm">"{lastResponse}"</p>
                  {onSpeak && (
                    <button
                      onClick={() => onSpeak(lastResponse)}
                      className="mt-2 px-3 py-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-400 rounded text-xs transition-colors"
                    >
                      🔊 Ouvir
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Previous Commands */}
          {commands.slice(-5).reverse().map((cmd, index) => (
            <div
              key={index}
              className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30"
            >
              <div className="flex justify-between items-start mb-1">
                <p className="text-slate-400 text-xs font-mono">"{cmd.input}"</p>
                <span className="text-slate-600 text-xs">
                  {cmd.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-green-400/70 text-xs font-mono">→ {cmd.response}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
