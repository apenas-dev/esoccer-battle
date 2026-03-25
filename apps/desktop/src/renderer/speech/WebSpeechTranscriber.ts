/**
 * WebSpeech Transcriber Adapter
 * Uses browser-native WebSpeech API for real-time speech-to-text
 * Works in Chrome/Edge (Tauri uses Chromium)
 * Follows SOLID (DIP) + KISS + camelCase
 */

// Type definitions for browser SpeechRecognition API
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

/**
 * Get the SpeechRecognition constructor (cross-browser)
 */
function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export interface WebSpeechCallbacks {
  onResult: (text: string, isFinal: boolean) => void;
  onError?: (error: Error) => void;
}

export class WebSpeechTranscriber {
  private recognition: SpeechRecognitionInstance | null = null;
  private listening = false;
  private manualStop = false;
  private restartAttempts = 0;
  private maxRestartAttempts = 3;
  private callbacks: WebSpeechCallbacks = { onResult: () => {} };

  static isSupported(): boolean {
    return getSpeechRecognition() !== null;
  }

  isListening(): boolean {
    return this.listening;
  }

  startListening(callbacks: WebSpeechCallbacks): void {
    if (this.listening) {
      console.warn('[WebSpeech] Already listening');
      return;
    }

    const SpeechRecognition = getSpeechRecognition();

    if (!SpeechRecognition) {
      callbacks.onError?.(new Error(
        'WebSpeech API não está disponível. Use Chrome ou Edge.'
      ));
      return;
    }

    this.callbacks = callbacks;
    this.manualStop = false;
    this.restartAttempts = 0;

    this.initRecognition(SpeechRecognition);

    try {
      this.recognition!.start();
    } catch (err) {
      const error = err instanceof Error
        ? err
        : new Error('Falha ao iniciar reconhecimento de voz');
      callbacks.onError?.(error);
    }
  }

  stopListening(): void {
    this.manualStop = true;
    this.restartAttempts = this.maxRestartAttempts;
    this.listening = false;

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (err) {
        console.warn('[WebSpeech] Stop error:', err);
      }
      this.recognition = null;
    }
  }

  private initRecognition(SpeechRecognition: new () => SpeechRecognitionInstance): void {
    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'pt-BR';
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      console.log('[WebSpeech] Started');
      this.listening = true;
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim();
        if (transcript) {
          this.callbacks.onResult(transcript, result.isFinal);
        }
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;

      if (event.error === 'network' && this.restartAttempts < this.maxRestartAttempts) {
        this.tryRestart();
        return;
      }

      this.callbacks.onError?.(
        new Error(`Erro de reconhecimento: ${event.error}`)
      );
      this.listening = false;
    };

    this.recognition.onend = () => {
      this.listening = false;
      if (!this.manualStop && this.restartAttempts < this.maxRestartAttempts) {
        this.tryRestart();
      }
    };
  }

  private tryRestart(): void {
    if (this.manualStop) return;

    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    this.restartAttempts++;

    try {
      this.initRecognition(SpeechRecognition);
      this.recognition!.start();
      this.listening = true;
    } catch {
      this.listening = false;
    }
  }
}
