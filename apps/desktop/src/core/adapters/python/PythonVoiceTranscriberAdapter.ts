/**
 * Python Voice Transcriber Adapter
 * Implements VoiceTranscriberPort calling Python STT backend
 * Follows SOLID (DIP) + KISS + camelCase
 */

import { VoiceTranscriberPort, TranscriptionResult } from '../../ports/VoiceTranscriberPort';

const PYTHON_BACKEND_URL = 'http://127.0.0.1:8001';

export class PythonVoiceTranscriberAdapter implements VoiceTranscriberPort {
  private readonly baseUrl: string;

  constructor(baseUrl: string = PYTHON_BACKEND_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Transcribes audio using Python Whisper backend
   * Takes raw ArrayBuffer (usually WebM from MediaRecorder) and sends directly to /stt
   */
  async transcribeAudio(audioBuffer: ArrayBuffer): Promise<TranscriptionResult> {
    console.log('[PythonVoiceTranscriberAdapter] transcribeAudio called');
    console.log('[PythonVoiceTranscriberAdapter] audioBuffer type:', Object.prototype.toString.call(audioBuffer));

    // Validate input
    if (!audioBuffer) {
      console.error('[PythonVoiceTranscriberAdapter] audioBuffer is null or undefined');
      throw new Error('Buffer de áudio inválido');
    }

    // Check length
    const byteLength = audioBuffer.byteLength;
    console.log('[PythonVoiceTranscriberAdapter] audioBuffer byteLength:', byteLength);

    if (byteLength === 0) {
      console.error('[PythonVoiceTranscriberAdapter] audioBuffer is empty');
      throw new Error('Buffer de áudio vazio');
    }

    // Try to determine mime type from header if possible, else default to webm
    // WebM usually starts with 1A 45 DF A3
    const header = new Uint8Array(audioBuffer, 0, Math.min(4, byteLength));
    let mimeType = 'audio/webm';
    let filename = 'audio.webm';

    if (header[0] === 0x1a && header[1] === 0x45 && header[2] === 0xdf && header[3] === 0xa3) {
      console.log('[PythonVoiceTranscriberAdapter] Detected WebM signature');
      mimeType = 'audio/webm';
      filename = 'audio.webm';
    } else if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) {
      console.log('[PythonVoiceTranscriberAdapter] Detected WAV signature (RIFF)');
      mimeType = 'audio/wav';
      filename = 'audio.wav';
    }

    try {
      // Create Blob from raw ArrayBuffer
      const audioBlob = new Blob([audioBuffer], { type: mimeType });
      console.log('[PythonVoiceTranscriberAdapter] Blob created, size:', audioBlob.size, 'type:', mimeType);

      // Create form data with audio file
      const formData = new FormData();
      formData.append('file', audioBlob, filename);

      console.log('[PythonVoiceTranscriberAdapter] Sending to backend:', this.baseUrl + '/stt');

      // Call Python STT endpoint with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      try {
        const response = await fetch(`${this.baseUrl}/stt`, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[PythonVoiceTranscriberAdapter] Backend error:', response.status, errorText);
          throw new Error(`Erro do backend STT: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('[PythonVoiceTranscriberAdapter] Transcription result:', result);

        return { text: result.text || '' };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('[PythonVoiceTranscriberAdapter] Request timeout');
        throw new Error('Timeout: Backend demorou muito para responder');
      }
      console.error('[PythonVoiceTranscriberAdapter] Error:', error);
      throw error;
    }
  }
}
