/**
 * TextCommandInput — Quick command buttons (kept for quick actions panel)
 */

import React, { useState, useCallback } from 'react';

interface TextCommandInputProps {
  onSubmit: (command: string) => void;
  isProcessing: boolean;
}

const quickCommands = [
  { label: '🎮 Volta 6', command: 'volta seis minutos' },
  { label: '📊 Resultado', command: 'qual é o resultado' },
  { label: '⏸ Intervalo', command: 'intervalo' },
  { label: '🔴 Encerrar', command: 'encerrar partida' },
  { label: '⚽ Gol Time A', command: 'gol para o time a' },
  { label: '⚽ Gol Time B', command: 'gol para o time b' },
  { label: '❓ Comandos', command: 'comandos de voz' },
];

export function TextCommandInput({ onSubmit, isProcessing }: TextCommandInputProps): React.ReactElement {
  return (
    <div className="flex flex-wrap gap-1.5">
      {quickCommands.map(({ label, command }) => (
        <button
          key={command}
          onClick={() => onSubmit(command)}
          disabled={isProcessing}
          className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 rounded-lg text-xs transition-colors disabled:opacity-30"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
