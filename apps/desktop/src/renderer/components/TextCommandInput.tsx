/**
 * TextCommandInput Component
 * Text input for testing commands with quick buttons
 * Follows KISS + camelCase
 */

import React, { useState, useCallback } from 'react';

interface QuickCommand {
  label: string;
  command: string;
}

interface TextCommandInputProps {
  onSubmit: (command: string) => void;
  isProcessing: boolean;
}

const quickCommands: QuickCommand[] = [
  { label: '🎮 Volta 6', command: 'volta seis minutos' },
  { label: '📊 Resultado', command: 'qual é o resultado' },
  { label: '⏸️ Intervalo', command: 'intervalo' },
  { label: '🔴 Encerrar', command: 'encerrar partida' },
  { label: '⚽ Gol Time A', command: 'gol para o time a' },
  { label: '⚽ Gol Time B', command: 'gol para o time b' },
  { label: '❓ Comandos', command: 'comandos de voz' },
];

export function TextCommandInput({ onSubmit, isProcessing }: TextCommandInputProps): React.ReactElement {
  const [textInput, setTextInput] = useState('');

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!textInput.trim()) return;
      onSubmit(textInput);
      setTextInput('');
    },
    [textInput, onSubmit]
  );

  return (
    <section className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
      <h2 className="text-lg font-semibold text-slate-300 mb-4">⌨️ Comando de Texto</h2>

      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Digite um comando..."
          className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          disabled={isProcessing}
        />
        <button
          type="submit"
          disabled={isProcessing || !textInput.trim()}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isProcessing ? '⏳' : '➤'} Enviar
        </button>
      </form>

      {/* Quick command buttons */}
      <div className="flex flex-wrap gap-2 mt-4">
        {quickCommands.map(({ label, command }) => (
          <button
            key={command}
            onClick={() => setTextInput(command)}
            disabled={isProcessing}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
