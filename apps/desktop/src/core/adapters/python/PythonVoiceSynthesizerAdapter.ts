/**
 * Python Voice Synthesizer Adapter
 * Implements VoiceSynthesizerPort calling Python TTS backend
 * Follows SOLID (DIP) + KISS + camelCase
 */

import { VoiceSynthesizerPort } from '../../ports/VoiceSynthesizerPort';

const PYTHON_BACKEND_URL = 'http://127.0.0.1:8001';

export class PythonVoiceSynthesizerAdapter implements VoiceSynthesizerPort {
  private readonly baseUrl: string;

  constructor(baseUrl: string = PYTHON_BACKEND_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Synthesizes speech using Python Kokoro backend
   * Sends text to /tts endpoint and returns audio as Float32Array
   */
  async synthesizeSpeech(text: string): Promise<Float32Array> {
    console.log('[PythonVoiceSynthesizerAdapter] Synthesizing:', text);

    try {
      // Call Python TTS endpoint
      const response = await fetch(`${this.baseUrl}/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`TTS request failed: ${response.status} - ${errorText}`);
      }

      // Get WAV audio as ArrayBuffer
      const audioBuffer = await response.arrayBuffer();
      console.log('[PythonVoiceSynthesizerAdapter] Received audio bytes:', audioBuffer.byteLength);

      // Convert WAV to Float32Array
      const float32Audio = this.wavToFloat32(audioBuffer);
      return float32Audio;
    } catch (error) {
      console.error('[PythonVoiceSynthesizerAdapter] Error:', error);
      throw error;
    }
  }

  /**
   * Converts WAV buffer to Float32Array audio samples
   */
  private wavToFloat32(wavBuffer: ArrayBuffer): Float32Array {
    const view = new DataView(wavBuffer);

    // Find data chunk (skip header)
    let dataOffset = 12; // After 'RIFF' + size + 'WAVE'

    // Search for 'data' chunk
    while (dataOffset < wavBuffer.byteLength - 8) {
      const chunkId = String.fromCharCode(
        view.getUint8(dataOffset),
        view.getUint8(dataOffset + 1),
        view.getUint8(dataOffset + 2),
        view.getUint8(dataOffset + 3)
      );
      const chunkSize = view.getUint32(dataOffset + 4, true);

      if (chunkId === 'data') {
        dataOffset += 8;
        const numSamples = chunkSize / 2; // 16-bit samples
        const samples = new Float32Array(numSamples);

        for (let i = 0; i < numSamples; i++) {
          const sample = view.getInt16(dataOffset + i * 2, true);
          samples[i] = sample / 32768.0;
        }

        return samples;
      }

      dataOffset += 8 + chunkSize;
    }

    // Fallback: assume standard 44-byte header
    const numSamples = (wavBuffer.byteLength - 44) / 2;
    const samples = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const sample = view.getInt16(44 + i * 2, true);
      samples[i] = sample / 32768.0;
    }

    return samples;
  }

  /**
   * Gets raw WAV bytes for direct playback
   */
  async synthesizeSpeechToWav(text: string): Promise<ArrayBuffer> {
    const response = await fetch(`${this.baseUrl}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`TTS request failed: ${response.status}`);
    }

    return response.arrayBuffer();
  }
}
