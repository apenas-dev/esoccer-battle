import { describe, it, expect, beforeAll } from 'vitest';
import { getBackendUrl } from '../setup';

describe('TTS (Text-to-Speech) Endpoint', () => {
  beforeAll(async () => {
    // Garante que os modelos estão baixados
    await fetch(`${getBackendUrl()}/models/download`, { method: 'POST' });
  }, 120000);

  it('POST /tts deve aceitar texto e retornar áudio WAV', async () => {
    const response = await fetch(`${getBackendUrl()}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: 'Volta de seis minutos' }),
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);

    // Verifica Content-Type
    const contentType = response.headers.get('content-type');
    expect(contentType).toContain('audio/wav');

    // Verifica que o corpo é um áudio válido
    const audioBuffer = await response.arrayBuffer();
    expect(audioBuffer.byteLength).toBeGreaterThan(0);

    // Verifica header RIFF do WAV
    const uint8Array = new Uint8Array(audioBuffer);
    const riffHeader = String.fromCharCode(...uint8Array.slice(0, 4));
    expect(riffHeader).toBe('RIFF');

    // Verifica formato WAVE
    const waveFormat = String.fromCharCode(...uint8Array.slice(8, 12));
    expect(waveFormat).toBe('WAVE');

    console.log(`[TTS] Áudio gerado: ${audioBuffer.byteLength} bytes`);
  }, 60000);

  it('POST /tts deve gerar áudio para texto em português', async () => {
    const testTexts = [
      'Gol do Brasil!',
      'Resultado: três a dois',
      'Partida finalizada',
    ];

    for (const text of testTexts) {
      const response = await fetch(`${getBackendUrl()}/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      expect(response.ok).toBe(true);
      
      const audioBuffer = await response.arrayBuffer();
      expect(audioBuffer.byteLength).toBeGreaterThan(44); // Mínimo para header WAV

      console.log(`[TTS] "${text}" -> ${audioBuffer.byteLength} bytes`);
    }
  }, 90000);

  it('POST /tts deve retornar erro 422 sem texto', async () => {
    const response = await fetch(`${getBackendUrl()}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(422);
  });
});
