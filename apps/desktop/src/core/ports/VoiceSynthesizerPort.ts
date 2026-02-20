/**
 * Voice Synthesizer Port (DIP - Dependency Inversion)
 * Domain depends on this interface, not concrete implementations
 */

export interface VoiceSynthesizerPort {
  synthesizeSpeech(text: string): Promise<Float32Array>;
}
