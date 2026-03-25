/**
 * CommandHistory — Sidebar with icon'd command list
 * Dark theme, sports broadcast style
 */

import React, { useEffect, useRef } from 'react';

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

function getCommandIcon(input: string): { icon: string; color: string } {
  const lower = input.toLowerCase();
  if (lower.includes('volta') || lower.includes('iniciar'))
    return { icon: '⏱', color: 'text-accent-blue' };
  if (lower.includes('intervalo') || lower.includes('pausa'))
    return { icon: '⏸', color: 'text-yellow-400' };
  if (lower.includes('encerrar') || lower.includes('finaliz'))
    return { icon: '❌', color: 'text-[#FF3B5C]' };
  if (lower.includes('resultado') || lower.includes('placar'))
    return { icon: '📊', color: 'text-accent-green' };
  if (lower.includes('gol'))
    return { icon: '⚽', color: 'text-[#FFD700]' };
  return { icon: '❓', color: 'text-slate-400' };
}

export function CommandHistory({
  commands,
  lastTranscription,
  lastResponse,
}: CommandHistoryProps): React.ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new commands
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [commands.length, lastTranscription]);

  const hasContent = commands.length > 0 || lastTranscription || lastResponse;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-300">Histórico</span>
        {commands.length > 0 && (
          <span className="text-xs bg-white/10 text-slate-500 px-2 py-0.5 rounded-full">
            {commands.length}
          </span>
        )}
      </div>

      {/* Command list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1"
      >
        {!hasContent ? (
          <div className="text-center py-12">
            <p className="text-slate-600 text-sm">Nenhum comando</p>
            <p className="text-slate-700 text-xs mt-1">Use voz ou texto</p>
          </div>
        ) : (
          <>
            {/* Last command highlighted */}
            {lastTranscription && (
              <div className="flex gap-3 p-3 rounded-lg bg-[#00FF87]/5 border-l-2 border-[#00FF87] animate-slideInLeft">
                <span className="text-lg flex-shrink-0 mt-0.5">
                  {getCommandIcon(lastTranscription).icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 text-sm font-mono truncate">
                    {lastTranscription}
                  </p>
                  {lastResponse && (
                    <p className="text-slate-500 text-xs mt-0.5 line-clamp-2">
                      {lastResponse}
                    </p>
                  )}
                  <span className="text-slate-600 text-xs font-mono">
                    agora
                  </span>
                </div>
              </div>
            )}

            {/* Previous commands (reversed, skip last) */}
            {commands
              .slice(0, -1)
              .reverse()
              .map((cmd, index) => {
                const iconInfo = getCommandIcon(cmd.input);
                return (
                  <div
                    key={index}
                    className="flex gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <span className={`text-lg flex-shrink-0 mt-0.5 ${iconInfo.color}`}>
                      {iconInfo.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-300 text-sm font-mono truncate">
                        {cmd.input}
                      </p>
                      <p className="text-slate-600 text-xs mt-0.5 line-clamp-2">
                        {cmd.response}
                      </p>
                    </div>
                    <span className="text-slate-700 text-xs font-mono flex-shrink-0">
                      {cmd.timestamp.toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                );
              })}
          </>
        )}
      </div>
    </div>
  );
}
