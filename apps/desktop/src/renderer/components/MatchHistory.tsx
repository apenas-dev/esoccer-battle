/**
 * MatchHistory Component
 * Modal/panel showing past matches
 * Follows KISS + camelCase
 */

import React, { useState, useEffect } from 'react';
import type { Match } from '../../core/entities';

interface MatchHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

const statusLabels: Record<string, string> = {
  aguardando: 'Aguardando',
  emAndamento: 'Em Andamento',
  pausado: 'Pausado',
  encerrado: 'Encerrado',
};

export function MatchHistory({ isOpen, onClose }: MatchHistoryProps): React.ReactElement | null {
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadMatches();
    }
  }, [isOpen]);

  const loadMatches = async () => {
    setIsLoading(true);
    try {
      const history = await window.esoccerApi?.getMatchHistory?.();
      setMatches(history || []);
    } catch {
      console.error('Failed to load match history');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">📊 Histórico de Partidas</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-700 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          ) : matches.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500 text-lg">Nenhuma partida registrada</p>
              <p className="text-slate-600 text-sm mt-2">Inicie uma partida com "volta seis minutos"</p>
            </div>
          ) : (
            <div className="space-y-3">
              {matches.map((match) => (
                <div
                  key={match.id}
                  className={`bg-slate-900/50 rounded-lg p-4 border ${
                    match.status === 'encerrado'
                      ? 'border-slate-600/50'
                      : 'border-blue-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-sm text-slate-400">Time A</p>
                        <p className="text-3xl font-bold text-blue-400">{match.scoreA}</p>
                      </div>
                      <div className="text-2xl text-slate-600">×</div>
                      <div className="text-center">
                        <p className="text-sm text-slate-400">Time B</p>
                        <p className="text-3xl font-bold text-blue-400">{match.scoreB}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          match.status === 'emAndamento'
                            ? 'bg-green-500/20 text-green-400'
                            : match.status === 'pausado'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : match.status === 'encerrado'
                            ? 'bg-slate-600/50 text-slate-400'
                            : 'bg-slate-700/50 text-slate-400'
                        }`}
                      >
                        {statusLabels[match.status] || match.status}
                      </span>
                      <p className="text-slate-600 text-xs mt-2">
                        {new Date(match.startedAt || Date.now()).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-900/50">
          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
