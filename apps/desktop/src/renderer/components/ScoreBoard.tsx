/**
 * ScoreBoard Component — TV-style scoreboard
 * Dark theme, ESPN/BandSports inspired
 */

import React, { useEffect, useState } from 'react';
import type { Match } from '../../core/entities';

interface ScoreBoardProps {
  match: Match | null;
  isLoading: boolean;
}

const statusConfig: Record<string, { text: string; badgeClass: string }> = {
  aguardando: {
    text: 'PRONTO',
    badgeClass: 'bg-white/10 text-slate-300',
  },
  emAndamento: {
    text: 'AO VIVO',
    badgeClass: 'bg-[#FF3B5C] text-white live-pulse',
  },
  pausado: {
    text: '⏸ INTERVALO',
    badgeClass: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  },
  encerrado: {
    text: 'ENCERRADO',
    badgeClass: 'bg-[#FF3B5C]/20 text-[#FF3B5C] border border-[#FF3B5C]/30',
  },
};

export function ScoreBoard({ match, isLoading }: ScoreBoardProps): React.ReactElement {
  const [flashA, setFlashA] = useState(false);
  const [flashB, setFlashB] = useState(false);
  const [prevScoreA, setPrevScoreA] = useState(0);
  const [prevScoreB, setPrevScoreB] = useState(0);
  const [elapsedTime, setElapsedTime] = useState('00:00');

  // Animate score changes (gol flash)
  useEffect(() => {
    if (match) {
      if (match.scoreA !== prevScoreA) {
        setFlashA(true);
        setPrevScoreA(match.scoreA);
        setTimeout(() => setFlashA(false), 500);
      }
      if (match.scoreB !== prevScoreB) {
        setFlashB(true);
        setPrevScoreB(match.scoreB);
        setTimeout(() => setFlashB(false), 500);
      }
    }
  }, [match?.scoreA, match?.scoreB]);

  // Timer for emAndamento
  useEffect(() => {
    if (!match || match.status !== 'emAndamento' || !match.startedAt) {
      setElapsedTime('00:00');
      return;
    }

    const calc = () => {
      const start = new Date(match.startedAt!).getTime();
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      setElapsedTime(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    };

    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [match?.status, match?.startedAt]);

  // Skeleton
  if (isLoading) {
    return (
      <section className="flex items-center justify-center py-16">
        <div className="flex gap-2">
          <div className="w-3 h-3 bg-accent-blue rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-3 h-3 bg-accent-blue rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-3 h-3 bg-accent-blue rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </section>
    );
  }

  // Empty state — Pronto
  if (!match || match.status === 'aguardando') {
    return (
      <section className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-7xl mb-6">⚽</div>
        <h2 className="text-3xl font-black tracking-tight text-slate-100 mb-3">
          E-SOCCER BATTLE
        </h2>
        <p className="text-slate-500 text-lg mb-8">
          Diga <span className="text-accent-blue font-mono font-semibold">"volta seis"</span> para iniciar
        </p>
        <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-accent-green/10 border border-accent-green/30">
          <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
          <span className="text-accent-green text-sm font-medium">Microfone Pronto</span>
        </div>
      </section>
    );
  }

  const cfg = statusConfig[match.status] || statusConfig.aguardando;

  return (
    <section className="flex flex-col items-center justify-center py-10 w-full">
      {/* Badge de status */}
      <div className="mb-6">
        <span className={`inline-block px-5 py-1.5 rounded-full text-sm font-bold tracking-wider ${cfg.badgeClass}`}>
          {cfg.text}
        </span>
      </div>

      {/* Placar principal */}
      <div className="flex items-center gap-6 sm:gap-10 md:gap-16 w-full justify-center">
        {/* Time A */}
        <div className="text-center flex-1 max-w-[200px]">
          <p className="text-sm sm:text-xl font-bold tracking-wider uppercase text-accent-blue mb-2">
            TIME A
          </p>
          <div className="relative">
            <div
              className={`text-6xl sm:text-8xl font-black tabular-nums transition-all duration-300 ${
                flashA ? 'animate-flash text-[#FFD700]' : 'text-slate-100'
              }`}
            >
              {match.scoreA}
            </div>
          </div>
        </div>

        {/* Separador */}
        <div className="flex flex-col items-center">
          <span className="text-4xl sm:text-6xl text-slate-600 font-light">×</span>
          {match.status === 'emAndamento' && (
            <span className="font-mono text-lg sm:text-2xl tabular-nums text-[#00FF87] mt-2">
              ⏱ {elapsedTime}
            </span>
          )}
        </div>

        {/* Time B */}
        <div className="text-center flex-1 max-w-[200px]">
          <p className="text-sm sm:text-xl font-bold tracking-wider uppercase text-[#FF3B5C] mb-2">
            TIME B
          </p>
          <div className="relative">
            <div
              className={`text-6xl sm:text-8xl font-black tabular-nums transition-all duration-300 ${
                flashB ? 'animate-flash text-[#FFD700]' : 'text-slate-100'
              }`}
            >
              {match.scoreB}
            </div>
          </div>
        </div>
      </div>

      {/* Período / Duração */}
      {match.status !== 'emAndamento' && (
        <div className="mt-6 flex items-center gap-3">
          <span className="bg-white/10 rounded-full px-4 py-1 text-sm text-slate-400">
            Volta {match.durationMinutes} min
          </span>
          {match.status === 'emAndamento' || match.startedAt ? (
            <span className="font-mono text-sm text-slate-500">⏱ {elapsedTime}</span>
          ) : null}
        </div>
      )}
    </section>
  );
}
