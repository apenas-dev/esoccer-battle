import { describe, it, expect } from 'vitest';
import { getBackendUrl } from '../setup';

describe('Health Endpoint', () => {
  it('GET /health deve retornar status ok', async () => {
    const response = await fetch(`${getBackendUrl()}/health`);
    
    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toEqual({ status: 'ok' });
  });

  it('GET /health deve ter Content-Type application/json', async () => {
    const response = await fetch(`${getBackendUrl()}/health`);
    
    const contentType = response.headers.get('content-type');
    expect(contentType).toContain('application/json');
  });
});
