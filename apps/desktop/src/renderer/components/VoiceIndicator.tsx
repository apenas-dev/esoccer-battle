/**
 * VoiceIndicator Component
 * Shows voice state with animations (listening/processing/responding)
 * Follows KISS + camelCase
 */

import React from 'react';

type VoiceState = 'idle' | 'listening' | 'stopping' | 'processing' | 'responding';

interface VoiceIndicatorProps {
  isRecording: boolean;
  isStopping?: boolean;
  isProcessing: boolean;
  isSpeaking?: boolean;
  backendOnline: boolean;
  onToggleRecording: () => void;
  error?: string | null;
}

const voiceStates: Record<VoiceState, { label: string; color: string; pulseClass: string }> = {
  idle: { label: 'Pronto', color: 'bg-slate-600', pulseClass: '' },
  listening: { label: 'Escutando...', color: 'bg-red-500', pulseClass: 'animate-pulse' },
  stopping: { label: 'Parando...', color: 'bg-yellow-500', pulseClass: 'animate-pulse' },
  processing: { label: 'Processando...', color: 'bg-yellow-500', pulseClass: 'animate-pulse' },
  responding: { label: 'Respondendo...', color: 'bg-blue-500', pulseClass: 'animate-pulse' },
};

export function VoiceIndicator({
  isRecording,
  isStopping = false,
  isProcessing,
  isSpeaking = false,
  backendOnline,
  onToggleRecording,
  error,
}: VoiceIndicatorProps): React.ReactElement {
  // Determine current voice state
  const currentState: VoiceState = isSpeaking
    ? 'responding'
    : isProcessing
      ? 'processing'
      : isStopping
        ? 'stopping'
        : isRecording
          ? 'listening'
          : 'idle';

  const stateConfig = voiceStates[currentState];
  const isDisabled = !backendOnline || isProcessing || isSpeaking || isStopping;

  return (
    <section className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
      <h2 className="text-lg font-semibold text-slate-300 mb-4">🎤 Controle por Voz</h2>

      <div className="flex items-center gap-6">
        {/* Main Voice Button */}
        <button
          onClick={onToggleRecording}
          disabled={isDisabled}
          className={`relative w-24 h-24 rounded-full transition-all duration-300 shadow-lg ${isStopping
              ? 'bg-yellow-600 shadow-yellow-500/30'
              : isRecording
                ? 'bg-red-600 hover:bg-red-700 shadow-red-500/30'
                : 'bg-green-600 hover:bg-green-700 shadow-green-500/30'
            } disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none`}
        >
          {/* Pulse ring animation when recording */}
          {isRecording && !isStopping && (
            <>
              <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-30"></span>
              <span className="absolute inset-2 rounded-full bg-red-400 animate-ping opacity-20 animation-delay-200"></span>
            </>
          )}

          <span className="relative z-10 text-4xl">
            {isStopping ? '⏳' : isRecording ? '⏹' : isProcessing ? '⏳' : '🎙️'}
          </span>
        </button>

        {/* Status Info */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-3 h-3 rounded-full ${stateConfig.color} ${stateConfig.pulseClass}`}></div>
            <span className="text-white font-medium">{stateConfig.label}</span>
          </div>

          <p className="text-slate-500 text-sm">
            {isStopping
              ? 'Processando áudio gravado...'
              : isRecording
                ? 'Fale seu comando claramente'
                : isProcessing
                  ? 'Reconhecendo fala e processando comando...'
                  : isSpeaking
                    ? 'Reproduzindo resposta em áudio...'
                    : 'Clique no botão para iniciar a escuta'}
          </p>

          {!backendOnline && (
            <p className="text-red-400 text-sm mt-2">⚠️ Backend offline - funcionalidade limitada</p>
          )}
        </div>
      </div>

      {/* Voice Wave Animation */}
      {isRecording && !isStopping && (
        <div className="flex items-center justify-center gap-1 mt-4">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-green-500 rounded-full animate-sound-wave"
              style={{
                height: `${Math.random() * 20 + 10}px`,
                animationDelay: `${i * 0.1}s`,
              }}
            ></div>
          ))}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-4 bg-red-900/30 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
          ❌ {error}
        </div>
      )}
    </section>
  );
}
