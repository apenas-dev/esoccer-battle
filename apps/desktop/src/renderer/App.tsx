/**
 * E-Soccer Battle V2 — Main App
 * Dark sports broadcast theme
 * Grid: sidebar | scoreboard | info panel
 * Footer: VoiceIndicator + StatusBar
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useVoiceCommands, useMatch, useInitialization } from './hooks';
import {
  ScoreBoard,
  VoiceIndicator,
  CommandHistory,
  MatchHistory,
  StatusBar,
  TextCommandInput,
} from './components';

interface CommandEntry {
  input: string;
  response: string;
  timestamp: Date;
}

function HomeScreen(): React.ReactElement {
  const [appStatus, setAppStatus] = useState<'checking' | 'online' | 'degraded'>('checking');
  const [showHistory, setShowHistory] = useState(false);
  const [commandHistory, setCommandHistory] = useState<CommandEntry[]>([]);

  const {
    lastTranscription,
    lastResponse,
    isProcessing,
    isListening,
    error: cmdError,
    speechSupported,
    startListening,
    stopListening,
    processTextCommand,
  } = useVoiceCommands();

  const { match, isLoading: matchLoading, refreshMatch } = useMatch();

  // Check health on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const health = await window.esoccerApi?.getHealth();
        setAppStatus(
          health?.backend === 'online'
            ? 'online'
            : health?.backend === 'degraded'
              ? 'degraded'
              : 'online'
        );
      } catch {
        setAppStatus('online');
      }
    };
    checkHealth();
  }, []);

  // Track command history
  useEffect(() => {
    if (lastTranscription && lastResponse) {
      setCommandHistory((prev) => [
        ...prev,
        { input: lastTranscription, response: lastResponse, timestamp: new Date() },
      ]);
    }
  }, [lastTranscription, lastResponse]);

  // Refresh match when response comes in
  useEffect(() => {
    if (lastResponse) {
      refreshMatch();
    }
  }, [lastResponse, refreshMatch]);

  const handleVoiceToggle = useCallback(async () => {
    try {
      if (isListening) {
        stopListening();
      } else {
        startListening();
      }
    } catch (err) {
      console.error('[App] handleVoiceToggle error:', err);
    }
  }, [isListening, startListening, stopListening]);

  const handleTextCommand = useCallback(
    async (command: string) => {
      await processTextCommand(command);
      await refreshMatch();
    },
    [processTextCommand, refreshMatch]
  );

  const errorMessage = cmdError || null;

  return (
    <div className="flex flex-col h-screen bg-[#0B0F1A] text-slate-100">
      {/* Header */}
      <header className="flex-shrink-0 bg-[#131825] border-b border-white/[0.06] px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚽</span>
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight">
                <span className="text-accent-blue">E-SOCCER</span>
                <span className="text-slate-100"> BATTLE</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Status dot */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5">
              <div
                className={`w-2 h-2 rounded-full ${
                  appStatus === 'online'
                    ? 'bg-[#00FF87] animate-pulse'
                    : 'bg-yellow-400 animate-pulse'
                }`}
              />
              <span className="text-xs text-slate-500 hidden sm:inline">
                {appStatus === 'online' ? 'Online' : 'Verificando...'}
              </span>
            </div>

            {/* Quick commands (compact) */}
            <TextCommandInput onSubmit={handleTextCommand} isProcessing={isProcessing} />
          </div>
        </div>
      </header>

      {/* Main 3-column grid */}
      <main className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[280px_1fr_220px]">
        {/* Left sidebar — Command History */}
        <aside className="hidden lg:flex flex-col bg-[#0B0F1A] border-r border-white/[0.06]">
          <CommandHistory
            commands={commandHistory}
            lastTranscription={lastTranscription || undefined}
            lastResponse={lastResponse || undefined}
          />
        </aside>

        {/* Center — Scoreboard */}
        <section className="flex flex-col items-center justify-center overflow-y-auto">
          <ScoreBoard match={match} isLoading={matchLoading} />
        </section>

        {/* Right panel — Match info (placeholder for stats/events) */}
        <aside className="hidden lg:flex flex-col bg-[#0B0F1A] border-l border-white/[0.06]">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <span className="text-sm font-semibold text-slate-300">Info</span>
          </div>
          <div className="flex-1 p-4 space-y-3">
            {/* Match status card */}
            <div className="bg-[#131825] rounded-lg p-3 border border-white/[0.06]">
              <p className="text-xs text-slate-500 mb-1">Status</p>
              <p className="text-sm text-slate-300">
                {match
                  ? match.status === 'emAndamento'
                    ? '🎯 Em jogo'
                    : match.status === 'pausado'
                      ? '⏸ Intervalo'
                      : match.status === 'encerrado'
                        ? '🏁 Encerrado'
                        : '⏳ Aguardando'
                  : '⏳ Aguardando'}
              </p>
            </div>

            {/* Score breakdown */}
            {match && (
              <div className="bg-[#131825] rounded-lg p-3 border border-white/[0.06]">
                <p className="text-xs text-slate-500 mb-2">Placar</p>
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <p className="text-xs text-accent-blue">TIME A</p>
                    <p className="text-2xl font-black text-slate-100">{match.scoreA}</p>
                  </div>
                  <span className="text-slate-600 text-lg">×</span>
                  <div className="text-center">
                    <p className="text-xs text-[#FF3B5C]">TIME B</p>
                    <p className="text-2xl font-black text-slate-100">{match.scoreB}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Duration */}
            {match && (
              <div className="bg-[#131825] rounded-lg p-3 border border-white/[0.06]">
                <p className="text-xs text-slate-500 mb-1">Duração</p>
                <p className="text-sm text-slate-300">{match.durationMinutes} min / volta</p>
              </div>
            )}

            {/* Commands on mobile (shown when sidebar hidden) */}
            {commandHistory.length > 0 && (
              <div className="bg-[#131825] rounded-lg p-3 border border-white/[0.06] lg:hidden">
                <p className="text-xs text-slate-500 mb-2">Últimos comandos</p>
                <div className="space-y-2">
                  {commandHistory.slice(-3).reverse().map((cmd, i) => (
                    <div key={i} className="text-xs">
                      <p className="text-slate-300 font-mono truncate">"{cmd.input}"</p>
                      <p className="text-slate-600 truncate">{cmd.response}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* Footer: Voice Indicator */}
      <VoiceIndicator
        isRecording={isListening}
        isStopping={false}
        isProcessing={isProcessing}
        backendOnline={speechSupported}
        onToggleRecording={handleVoiceToggle}
        error={
          !speechSupported
            ? 'Reconhecimento de voz não suportado. Use Chrome ou Edge.'
            : errorMessage
        }
        onSubmitText={handleTextCommand}
        isSubmitting={isProcessing}
        lastTranscription={lastTranscription || undefined}
      />

      {/* Status Bar */}
      <StatusBar
        backendStatus={appStatus === 'online' ? 'online' : 'offline'}
        match={match}
        onShowHistory={() => setShowHistory(true)}
        speechSupported={speechSupported}
      />

      {/* Match History Modal */}
      <MatchHistory isOpen={showHistory} onClose={() => setShowHistory(false)} />
    </div>
  );
}

/**
 * Main App with Initialization Flow
 */
function App(): React.ReactElement {
  const { state, error, retry } = useInitialization();

  switch (state) {
    case 'checking':
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0B0F1A]">
          <div className="text-center">
            <div className="text-6xl mb-6 animate-bounce">⚽</div>
            <div className="flex justify-center gap-2 mb-4">
              <div className="w-3 h-3 bg-accent-blue rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-3 h-3 bg-accent-blue rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-3 h-3 bg-accent-blue rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <p className="text-slate-500 text-sm">Preparando narração...</p>
          </div>
        </div>
      );

    case 'error':
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0B0F1A]">
          <div className="text-center max-w-md px-6">
            <div className="text-6xl mb-6">❌</div>
            <p className="text-[#FF3B5C] text-lg mb-6">
              {error?.message || 'Erro na inicialização'}
            </p>
            <button
              onClick={retry}
              className="px-6 py-3 bg-accent-blue hover:bg-accent-blue/80 text-white rounded-xl font-semibold transition-colors"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      );

    case 'ready':
    default:
      return <HomeScreen />;
  }
}

export default App;
