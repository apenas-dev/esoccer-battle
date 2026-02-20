/**
 * E-Soccer Battle - Main App Component
 * Polished UI using separate components
 * Handles initialization flow: Download -> Loading -> Home
 * Follows KISS + SOLID + camelCase
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useMicrophone, useVoiceCommands, useMatch, useInitialization } from './hooks';
import {
  ScoreBoard,
  VoiceIndicator,
  CommandHistory,
  MatchHistory,
  StatusBar,
  TextCommandInput,
  DownloadScreen,
  LoadingScreen,
} from './components';

interface CommandEntry {
  input: string;
  response: string;
  timestamp: Date;
}

/**
 * Home Screen Component - Main app interface
 */
function HomeScreen(): React.ReactElement {
  // Backend health state
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  // Match history modal state
  const [showHistory, setShowHistory] = useState(false);

  // Command history for current session
  const [commandHistory, setCommandHistory] = useState<CommandEntry[]>([]);

  // Custom hooks
  const { isRecording, isStopping, error: micError, startRecording, stopRecording } = useMicrophone();
  const {
    lastTranscription,
    lastResponse,
    isProcessing,
    error: cmdError,
    processVoiceCommand,
    processTextCommand,
    speakText,
  } = useVoiceCommands();
  const { match, isLoading: matchLoading, refreshMatch } = useMatch();

  // Check backend health on mount and periodically
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const health = await window.esoccerApi?.getHealth();
        setBackendStatus(health?.backend === 'online' ? 'online' : 'offline');
      } catch {
        setBackendStatus('offline');
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
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

  // Handle voice button toggle
  const handleVoiceToggle = useCallback(async () => {
    try {
      if (isRecording) {
        const audioBuffer = await stopRecording();
        if (audioBuffer && audioBuffer.byteLength > 0) {
          await processVoiceCommand(audioBuffer);
          await refreshMatch();
        }
      } else {
        await startRecording();
      }
    } catch (err) {
      console.error('[App] handleVoiceToggle error:', err);
    }
  }, [isRecording, startRecording, stopRecording, processVoiceCommand, refreshMatch]);

  // Handle text command submission
  const handleTextCommand = useCallback(
    async (command: string) => {
      await processTextCommand(command);
      await refreshMatch();
    },
    [processTextCommand, refreshMatch]
  );

  // Combined error message
  const errorMessage = micError || cmdError || null;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-900/80 border-b border-blue-500/30 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="text-blue-400">⚽ E-Soccer</span>
              <span className="text-white"> Battle</span>
              <span className="text-green-400 ml-2 text-lg">- Volta 6</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {/* Backend Status Indicator */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/50">
              <div
                className={`w-2.5 h-2.5 rounded-full ${backendStatus === 'online'
                  ? 'bg-green-500 animate-pulse'
                  : backendStatus === 'offline'
                    ? 'bg-red-500'
                    : 'bg-yellow-500 animate-pulse'
                  }`}
              />
              <span className="text-sm text-slate-400">
                {backendStatus === 'online' ? '🟢 Online' : backendStatus === 'offline' ? '🔴 Offline' : '🟡 Verificando...'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Scoreboard */}
          <ScoreBoard match={match} isLoading={matchLoading} />

          {/* Voice Control */}
          <VoiceIndicator
            isRecording={isRecording}
            isStopping={isStopping}
            isProcessing={isProcessing}
            backendOnline={backendStatus === 'online'}
            onToggleRecording={handleVoiceToggle}
            error={errorMessage}
          />

          {/* Command History */}
          <CommandHistory
            commands={commandHistory}
            lastTranscription={lastTranscription || undefined}
            lastResponse={lastResponse || undefined}
            onSpeak={speakText}
          />

          {/* Text Command Input */}
          <TextCommandInput onSubmit={handleTextCommand} isProcessing={isProcessing} />
        </div>
      </main>

      {/* Status Bar Footer */}
      <StatusBar
        backendStatus={backendStatus}
        match={match}
        onShowHistory={() => setShowHistory(true)}
      />

      {/* Match History Modal */}
      <MatchHistory isOpen={showHistory} onClose={() => setShowHistory(false)} />
    </div>
  );
}

/**
 * Main App Component with Initialization Flow
 */
function App(): React.ReactElement {
  const {
    state,
    downloadProgress,
    loadingProgress,
    terminalLines,
    error,
    retry,
    restart,
  } = useInitialization();

  // Render based on initialization state
  switch (state) {
    case 'checking':
      // Brief loading while checking first run
      return (
        <LoadingScreen
          progress={{
            stage: 'backend',
            percentage: 5,
            message: 'Verificando sistema...',
          }}
        />
      );

    case 'downloading':
      return (
        <DownloadScreen
          progress={downloadProgress}
          terminalLines={terminalLines}
          error={error}
          onRetry={retry}
        />
      );

    case 'loading':
      return (
        <LoadingScreen
          progress={loadingProgress}
          error={error}
          onRestart={restart}
        />
      );

    case 'error':
      // Show error on appropriate screen based on where we failed
      if (downloadProgress.stage === 'error' || downloadProgress.percentage > 0) {
        return (
          <DownloadScreen
            progress={{ ...downloadProgress, stage: 'error' }}
            terminalLines={terminalLines}
            error={error}
            onRetry={retry}
          />
        );
      }
      return (
        <LoadingScreen
          progress={{ ...loadingProgress, stage: 'error' }}
          error={error}
          onRestart={restart}
        />
      );

    case 'ready':
    default:
      return <HomeScreen />;
  }
}

export default App;
