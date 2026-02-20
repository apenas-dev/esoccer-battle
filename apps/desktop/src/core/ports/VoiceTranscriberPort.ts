/**
 * Voice Transcriber Port (DIP - Dependency Inversion)
 * Domain depends on this interface, not concrete implementations
 */

export interface TranscriptionResult {
  text: string;
}

export interface VoiceTranscriberPort {
  transcribeAudio(audioBuffer: ArrayBuffer): Promise<TranscriptionResult>;
}
