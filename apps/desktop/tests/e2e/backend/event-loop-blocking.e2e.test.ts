/**
 * Event Loop Blocking E2E Tests
 * 
 * Tests the EXACT bug scenario: asyncio.to_thread() must prevent
 * the event loop from blocking during CPU-heavy STT/TTS processing.
 * 
 * If these tests fail, the original freeze bug has regressed.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { getBackendUrl } from '../setup';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

describe('Event Loop Blocking Prevention', () => {
    const testAudioPath = path.resolve(__dirname, '../../../test-assets/audio/volta-seis.wav');

    beforeAll(async () => {
        // Ensure models are downloaded before tests
        await fetch(`${getBackendUrl()}/models/download`, { method: 'POST' });

        // Warm up STT engine (first call triggers lazy model loading which IS blocking)
        if (existsSync(testAudioPath)) {
            const warmupBuffer = readFileSync(testAudioPath);
            const warmupForm = new FormData();
            warmupForm.append('file', new Blob([warmupBuffer], { type: 'audio/wav' }), 'warmup.wav');
            await fetch(`${getBackendUrl()}/stt`, { method: 'POST', body: warmupForm });
            console.log('[BLOCKING] STT warm-up complete');
        }

        // Warm up TTS engine
        await fetch(`${getBackendUrl()}/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: 'warmup' }),
        });
        console.log('[BLOCKING] TTS warm-up complete');
    }, 120000);

    it('GET /health deve responder DURANTE transcrição STT (prova que asyncio.to_thread funciona)', async () => {
        // Skip if no test audio
        if (!existsSync(testAudioPath)) {
            console.warn(`[SKIP] Test audio not found: ${testAudioPath}`);
            return;
        }

        const audioBuffer = readFileSync(testAudioPath);
        const formData = new FormData();
        formData.append('file', new Blob([audioBuffer], { type: 'audio/wav' }), 'volta-seis.wav');

        // Fire STT request (takes 1-10s with Whisper, models already warm)
        const sttPromise = fetch(`${getBackendUrl()}/stt`, {
            method: 'POST',
            body: formData,
        });

        // Wait 100ms for STT to start processing, then check health
        await new Promise(r => setTimeout(r, 100));

        const healthStart = Date.now();
        const healthResponse = await fetch(`${getBackendUrl()}/health`);
        const healthDuration = Date.now() - healthStart;

        // With asyncio.to_thread(), health should respond quickly
        // Allow up to 5s for CPU-only environments under load
        expect(healthResponse.ok).toBe(true);
        expect(healthDuration).toBeLessThan(5000);
        console.log(`[BLOCKING] Health responded in ${healthDuration}ms during STT ✓`);

        // Wait for STT to complete
        const sttResponse = await sttPromise;
        expect(sttResponse.ok).toBe(true);

        const sttData = await sttResponse.json();
        expect(sttData).toHaveProperty('text');
        console.log(`[BLOCKING] STT completed: "${sttData.text}"`);
    }, 60000);

    it('GET /health deve responder DURANTE síntese TTS', async () => {
        // Fire TTS request (takes 2-10s with Kokoro)
        const ttsPromise = fetch(`${getBackendUrl()}/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: 'Resultado parcial: dois a um para o time da casa, faltam três minutos para o final da partida' }),
        });

        // Wait 200ms for TTS to start processing, then check health
        await new Promise(r => setTimeout(r, 200));

        const healthStart = Date.now();
        const healthResponse = await fetch(`${getBackendUrl()}/health`);
        const healthDuration = Date.now() - healthStart;

        expect(healthResponse.ok).toBe(true);
        expect(healthDuration).toBeLessThan(2000);
        console.log(`[BLOCKING] Health responded in ${healthDuration}ms during TTS ✓`);

        // Wait for TTS to complete
        const ttsResponse = await ttsPromise;
        expect(ttsResponse.ok).toBe(true);

        const audioBytes = await ttsResponse.arrayBuffer();
        expect(audioBytes.byteLength).toBeGreaterThan(0);
        console.log(`[BLOCKING] TTS completed: ${audioBytes.byteLength} bytes`);
    }, 60000);

    it('STT e TTS devem funcionar em paralelo sem travar', async () => {
        if (!existsSync(testAudioPath)) {
            console.warn(`[SKIP] Test audio not found: ${testAudioPath}`);
            return;
        }

        const audioBuffer = readFileSync(testAudioPath);
        const formData = new FormData();
        formData.append('file', new Blob([audioBuffer], { type: 'audio/wav' }), 'volta-seis.wav');

        const startTime = Date.now();

        // Fire STT and TTS simultaneously
        const [sttResponse, ttsResponse] = await Promise.all([
            fetch(`${getBackendUrl()}/stt`, {
                method: 'POST',
                body: formData,
            }),
            fetch(`${getBackendUrl()}/tts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: 'Gol do time visitante' }),
            }),
        ]);

        const totalTime = Date.now() - startTime;

        expect(sttResponse.ok).toBe(true);
        expect(ttsResponse.ok).toBe(true);

        const sttData = await sttResponse.json();
        const ttsBytes = await ttsResponse.arrayBuffer();

        expect(sttData).toHaveProperty('text');
        expect(ttsBytes.byteLength).toBeGreaterThan(0);

        console.log(`[BLOCKING] Concurrent STT+TTS completed in ${totalTime}ms`);
        console.log(`[BLOCKING]   STT: "${sttData.text}"`);
        console.log(`[BLOCKING]   TTS: ${ttsBytes.byteLength} bytes`);
    }, 90000);

    it('Pipeline completo: STT → processar texto → TTS (simula fluxo real do bug)', async () => {
        if (!existsSync(testAudioPath)) {
            console.warn(`[SKIP] Test audio not found: ${testAudioPath}`);
            return;
        }

        const startTime = Date.now();

        // Step 1: Transcribe audio (simulates: user stops recording → audio sent to backend)
        const audioBuffer = readFileSync(testAudioPath);
        const formData = new FormData();
        formData.append('file', new Blob([audioBuffer], { type: 'audio/wav' }), 'volta-seis.wav');

        const sttResponse = await fetch(`${getBackendUrl()}/stt`, {
            method: 'POST',
            body: formData,
        });

        expect(sttResponse.ok).toBe(true);
        const sttData = await sttResponse.json();
        const transcribedText = sttData.text;
        console.log(`[PIPELINE] Step 1 - STT: "${transcribedText}"`);

        // Step 2: Verify server is still responsive between operations
        const healthResponse = await fetch(`${getBackendUrl()}/health`);
        expect(healthResponse.ok).toBe(true);
        console.log(`[PIPELINE] Step 2 - Health OK between STT and TTS`);

        // Step 3: Synthesize response (simulates: backend generates audio response)
        const responseText = `Comando recebido: ${transcribedText}. Partida iniciada.`;
        const ttsResponse = await fetch(`${getBackendUrl()}/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: responseText }),
        });

        expect(ttsResponse.ok).toBe(true);
        const audioOutput = await ttsResponse.arrayBuffer();
        expect(audioOutput.byteLength).toBeGreaterThan(0);

        const totalTime = Date.now() - startTime;
        console.log(`[PIPELINE] Step 3 - TTS: ${audioOutput.byteLength} bytes`);
        console.log(`[PIPELINE] Full pipeline completed in ${totalTime}ms ✓`);

        // The full pipeline should complete within the timeout without freezing
        expect(totalTime).toBeLessThan(60000);
    }, 90000);
});
