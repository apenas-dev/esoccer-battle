/**
 * Streaming Voice Transcriber Port (DIP - Dependency Inversion)
 * Interface for real-time speech-to-text via browser APIs
 * Unlike VoiceTranscriberPort, this works with continuous streaming
 * rather than sending audio buffers
 */

export interface StreamingVoiceTranscriberPort {
  startListening(onResult: (text: string, isFinal: boolean) => void, onError?: (error: Error) => void): void;
  stopListening(): void;
  isListening(): boolean;
  isSupported(): boolean;
}
