import { describe, it, expect } from 'vitest';
import { getBackendUrl } from '../setup';

interface ModelsDownloadResponse {
  whisperReady: boolean;
  kokoroReady: boolean;
}

describe('Models Download Endpoint', () => {
  it('POST /models/download deve retornar status dos modelos', async () => {
    const response = await fetch(`${getBackendUrl()}/models/download`, {
      method: 'POST',
    });
    
    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    
    const data: ModelsDownloadResponse = await response.json();
    
    // Verifica que a resposta tem os campos esperados
    expect(data).toHaveProperty('whisperReady');
    expect(data).toHaveProperty('kokoroReady');
    
    // Ambos devem ser booleanos
    expect(typeof data.whisperReady).toBe('boolean');
    expect(typeof data.kokoroReady).toBe('boolean');
  });

  it('POST /models/download deve ter modelos prontos após download', async () => {
    // Primeira chamada pode iniciar download
    const response = await fetch(`${getBackendUrl()}/models/download`, {
      method: 'POST',
    });
    
    const data: ModelsDownloadResponse = await response.json();
    
    // Após o download, ambos devem estar prontos
    expect(data.whisperReady).toBe(true);
    expect(data.kokoroReady).toBe(true);
  }, 120000); // Timeout de 2 minutos para download
});
