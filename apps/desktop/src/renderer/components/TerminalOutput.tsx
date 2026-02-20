/**
 * TerminalOutput Component
 * Styled terminal component for displaying real-time output
 * Follows SOLID + KISS + camelCase
 */

import React, { useRef, useEffect } from 'react';

export interface TerminalLine {
  id: string;
  text: string;
  type: 'info' | 'success' | 'error' | 'warning' | 'command';
  timestamp?: Date;
}

interface TerminalOutputProps {
  lines: TerminalLine[];
  title?: string;
  maxHeight?: string;
  autoScroll?: boolean;
}

export function TerminalOutput({
  lines,
  title = 'Terminal',
  maxHeight = '300px',
  autoScroll = true,
}: TerminalOutputProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new lines are added
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  const getLineColor = (type: TerminalLine['type']): string => {
    switch (type) {
      case 'success':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      case 'warning':
        return 'text-yellow-400';
      case 'command':
        return 'text-blue-400';
      default:
        return 'text-slate-300';
    }
  };

  const getLinePrefix = (type: TerminalLine['type']): string => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'warning':
        return '⚠';
      case 'command':
        return '$';
      default:
        return '>';
    }
  };

  return (
    <div className="rounded-lg overflow-hidden border border-slate-700 bg-slate-900/90">
      {/* Terminal Header */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 border-b border-slate-700">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <span className="text-sm text-slate-400 ml-2 font-mono">{title}</span>
      </div>

      {/* Terminal Content */}
      <div
        ref={containerRef}
        className="p-4 font-mono text-sm overflow-y-auto bg-slate-950"
        style={{ maxHeight }}
      >
        {lines.length === 0 ? (
          <div className="text-slate-500 animate-pulse">Aguardando...</div>
        ) : (
          lines.map((line) => (
            <div key={line.id} className="flex items-start gap-2 py-0.5">
              <span className={`${getLineColor(line.type)} flex-shrink-0`}>
                {getLinePrefix(line.type)}
              </span>
              <span className={`${getLineColor(line.type)} break-all`}>
                {line.text}
              </span>
            </div>
          ))
        )}
        {/* Cursor blink */}
        <div className="inline-block w-2 h-4 bg-green-400 animate-pulse ml-1" />
      </div>
    </div>
  );
}
