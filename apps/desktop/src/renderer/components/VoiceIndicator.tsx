/**
 * VoiceIndicator — Fixed footer bar with mic + text input
 * Dark theme, minimal sports broadcast style
 */

import React, { useState } from 'react';

interface VoiceIndicatorProps {
  isRecording: boolean;
  isStopping?: boolean;
  isProcessing: boolean;
  isSpeaking?: boolean;
  backendOnline: boolean;
  onToggleRecording: () => void;
  error?: string | null;
  onSubmitText?: (text: string) => void;
  isSubmitting?: boolean;
  lastTranscription?: string;
}

export function VoiceIndicator({
  isRecording,
  isStopping = false,
  isProcessing,
  isSpeaking = false,
  backendOnline,
  onToggleRecording,
  error,
  onSubmitText,
  isSubmitting,
  lastTranscription,
}: VoiceIndicatorProps): React.ReactElement {
  const [textInput, setTextInput] = useState('');

  const isListening = isRecording && !isStopping;
  const isDisabled = !backendOnline || isProcessing || isSpeaking || isStopping;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || !onSubmitText) return;
    onSubmitText(textInput.trim());
    setTextInput('');
  };

  return (
    <div className="bg-[#131825] border-t border-white/[0.06] px-4 sm:px-6 py-3">
      <div className="flex items-center gap-3 sm:gap-4 max-w-5xl mx-auto">
        {/* Mic button */}
        <div className="relative flex-shrink-0">
          {/* Pulsing rings when listening */}
          {isListening && (
            <>
              <span className="absolute inset-0 rounded-full bg-[#FF3B5C] animate-micRing" />
              <span className="absolute -inset-2 rounded-full bg-[#FF3B5C]/30 animate-micRing" style={{ animationDelay: '0.5s' }} />
            </>
          )}

          <button
            onClick={onToggleRecording}
            disabled={isDisabled}
            className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
              isStopping
                ? 'bg-yellow-500 text-white'
                : isListening
                  ? 'bg-[#FF3B5C] text-white scale-105'
                  : isProcessing
                    ? 'bg-yellow-500/80 text-white animate-pulse'
                    : 'bg-[#1A2035] text-slate-500 hover:text-slate-300 hover:bg-white/10'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {isStopping ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : isListening ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>
        </div>

        {/* Sound wave bars when listening */}
        {isListening && (
          <div className="hidden sm:flex items-end gap-[3px] h-8">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="wave-bar"
                style={{
                  animationDelay: `${i * 0.08}s`,
                  height: `${8 + Math.random() * 24}px`,
                }}
              />
            ))}
          </div>
        )}

        {/* Interim text / status */}
        <div className="flex-1 min-w-0">
          {isListening && lastTranscription ? (
            <p className="text-[#00FF87] text-sm font-mono truncate">
              {lastTranscription}
            </p>
          ) : isListening ? (
            <p className="text-slate-500 text-sm italic">Escutando...</p>
          ) : isProcessing ? (
            <p className="text-yellow-400 text-sm">Processando...</p>
          ) : null}
        </div>

        {/* Text input */}
        {onSubmitText && (
          <form onSubmit={handleSubmit} className="flex items-center gap-2 flex-shrink-0">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Digite um comando..."
              className="w-40 sm:w-56 lg:w-72 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-accent-green/40 transition-colors"
              disabled={isSubmitting}
            />
            <button
              type="submit"
              disabled={isSubmitting || !textInput.trim()}
              className="px-4 py-2.5 bg-accent-green/20 hover:bg-accent-green/30 text-accent-green rounded-xl text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Enviar
            </button>
          </form>
        )}

        {/* Error shake */}
        {error && (
          <div className="flex-shrink-0 px-3 py-1.5 bg-[#FF3B5C]/10 border border-[#FF3B5C]/20 rounded-lg animate-[slideInLeft_0.3s_ease-out]">
            <p className="text-[#FF3B5C] text-xs">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
