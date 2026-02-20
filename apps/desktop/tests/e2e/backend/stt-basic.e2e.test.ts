import { describe, it, expect, beforeAll } from 'vitest';
import { getBackendUrl } from '../setup';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

describe('STT (Speech-to-Text) Endpoint', () => {
  const testAudioPath = path.resolve(__dirname, '../../../test-assets/audio/volta-seis.wav');

  beforeAll(async () => {
    // Garante que os modelos estão baixados
    await fetch(`${getBackendUrl()}/models/download`, { method: 'POST' });
  }, 120000);

  it('POST /stt deve aceitar arquivo de áudio e retornar transcrição', async () => {
    // Verifica se o arquivo de teste existe
    if (!existsSync(testAudioPath)) {
      console.warn(`[SKIP] Arquivo de teste não encontrado: ${testAudioPath}`);
      return;
    }

    const audioBuffer = readFileSync(testAudioPath);
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: 'audio/wav' }), 'volta-seis.wav');

    const response = await fetch(`${getBackendUrl()}/stt`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[STT] Error response (${response.status}): ${errorText}`);
    }
    
    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('text');
    expect(typeof data.text).toBe('string');
    
    console.log(`[STT] Transcrição: "${data.text}"`);
  }, 60000);

  it('POST /stt deve retornar erro 422 sem arquivo de áudio', async () => {
    const response = await fetch(`${getBackendUrl()}/stt`, {
      method: 'POST',
    });

    // FastAPI retorna 422 para validação de parâmetros
    expect(response.status).toBe(422);
  });
});
