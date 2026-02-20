/**
 * ScoreBoard Component
 * Displays match score with animations
 * Follows KISS + camelCase
 */

import React, { useEffect, useState } from 'react';
import type { Match } from '../../core/entities';

interface ScoreBoardProps {
  match: Match | null;
  isLoading: boolean;
}

const statusLabels: Record<string, { text: string; className: string }> = {
  aguardando: { text: 'Aguardando', className: 'text-slate-400' },
  emAndamento: { text: 'Em Andamento', className: 'text-green-400' },
  pausado: { text: 'Pausado', className: 'text-yellow-400' },
  encerrado: { text: 'Encerrado', className: 'text-red-400' },
};

export function ScoreBoard({ match, isLoading }: ScoreBoardProps): React.ReactElement {
  const [animateScoreA, setAnimateScoreA] = useState(false);
  const [animateScoreB, setAnimateScoreB] = useState(false);
  const [prevScoreA, setPrevScoreA] = useState(0);
  const [prevScoreB, setPrevScoreB] = useState(0);

  // Animate score changes
  useEffect(() => {
    if (match) {
      if (match.scoreA !== prevScoreA) {
        setAnimateScoreA(true);
        setPrevScoreA(match.scoreA);
        setTimeout(() => setAnimateScoreA(false), 500);
      }
      if (match.scoreB !== prevScoreB) {
        setAnimateScoreB(true);
        setPrevScoreB(match.scoreB);
        setTimeout(() => setAnimateScoreB(false), 500);
      }
    }
  }, [match?.scoreA, match?.scoreB]);

  if (isLoading) {
    return (
      <section className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
        <h2 className="text-lg font-semibold text-slate-300 mb-4">⚽ Placar</h2>
        <div className="flex items-center justify-center h-32">
          <div className="animate-pulse flex gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full animation-delay-200"></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full animation-delay-400"></div>
          </div>
        </div>
      </section>
    );
  }

  if (!match) {
    return (
      <section className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
        <h2 className="text-lg font-semibold text-slate-300 mb-4">⚽ Placar</h2>
        <div className="text-center py-8">
          <p className="text-slate-500 text-lg">Nenhuma partida ativa</p>
          <p className="text-slate-600 text-sm mt-2">
            Diga <span className="text-blue-400 font-mono">"volta seis minutos"</span> para iniciar
          </p>
        </div>
      </section>
    );
  }

  const statusConfig = statusLabels[match.status] || statusLabels.aguardando;

  return (
    <section className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
      <h2 className="text-lg font-semibold text-slate-300 mb-4">⚽ Placar</h2>
      <div className="flex items-center justify-center gap-8">
        {/* Team A */}
        <div className="text-center flex-1">
          <p className="text-xl font-bold text-white mb-2">Time A</p>
          <p
            className={`text-6xl font-bold text-blue-400 transition-all duration-300 ${
              animateScoreA ? 'scale-125 text-green-400' : 'scale-100'
            }`}
          >
            {match.scoreA}
          </p>
        </div>

        {/* Center Status */}
        <div className="text-center px-8">
          <p className="text-4xl font-bold text-slate-600">×</p>
          <div className={`mt-3 px-4 py-1 rounded-full text-sm font-medium ${
            match.status === 'emAndamento' ? 'bg-green-500/20 border border-green-500/40' :
            match.status === 'pausado' ? 'bg-yellow-500/20 border border-yellow-500/40' :
            match.status === 'encerrado' ? 'bg-red-500/20 border border-red-500/40' :
            'bg-slate-700/50 border border-slate-600/40'
          } ${statusConfig.className}`}>
            {statusConfig.text}
          </div>
        </div>

        {/* Team B */}
        <div className="text-center flex-1">
          <p className="text-xl font-bold text-white mb-2">Time B</p>
          <p
            className={`text-6xl font-bold text-blue-400 transition-all duration-300 ${
              animateScoreB ? 'scale-125 text-green-400' : 'scale-100'
            }`}
          >
            {match.scoreB}
          </p>
        </div>
      </div>
    </section>
  );
}
