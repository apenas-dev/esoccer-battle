/**
 * MatchHistory — Modal showing past matches
 * Dark theme
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
    if (isOpen) loadMatches();
  }, [isOpen]);

  const loadMatches = async () => {
    setIsLoading(true);
    try {
      const history = await window.esoccerApi?.getMatchHistory?.();
      setMatches(history || []);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#131825] rounded-xl border border-white/[0.06] w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <h2 className="text-lg font-bold text-slate-100">📊 Histórico de Partidas</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh] custom-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full" />
            </div>
          ) : matches.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500">Nenhuma partida registrada</p>
              <p className="text-slate-600 text-sm mt-2">Diga "volta seis minutos" para iniciar</p>
            </div>
          ) : (
            <div className="space-y-2">
              {matches.map((m) => (
                <div
                  key={m.id}
                  className="bg-[#1A2035] rounded-lg p-4 border border-white/[0.06] flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-black text-accent-blue">{m.scoreA}</span>
                    <span className="text-slate-600 text-lg">×</span>
                    <span className="text-2xl font-black text-[#FF3B5C]">{m.scoreB}</span>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        m.status === 'emAndamento'
                          ? 'bg-[#00FF87]/10 text-[#00FF87]'
                          : m.status === 'pausado'
                            ? 'bg-yellow-500/10 text-yellow-400'
                            : m.status === 'encerrado'
                              ? 'bg-[#FF3B5C]/10 text-[#FF3B5C]'
                              : 'bg-white/5 text-slate-400'
                      }`}
                    >
                      {statusLabels[m.status] || m.status}
                    </span>
                    <p className="text-slate-600 text-xs mt-1 font-mono">
                      {new Date(m.startedAt || Date.now()).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.06]">
          <button
            onClick={onClose}
            className="w-full py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-sm transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
