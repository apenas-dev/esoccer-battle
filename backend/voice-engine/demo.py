#!/usr/bin/env python3
"""
E-Soccer Battle Voice Engine - Demo Script

Script standalone para testar todos os endpoints da API.
Executar com: python demo.py

Pré-requisitos:
- pip install requests
- Backend rodando em http://127.0.0.1:8001
"""

import sys
import time
import json
import wave
import struct
import math
from pathlib import Path

try:
    import requests
except ImportError:
    print("Erro: Módulo 'requests' não instalado.")
    print("Execute: pip install requests")
    sys.exit(1)


BASE_URL = "http://127.0.0.1:8001"


def print_header(title: str):
    """Imprime cabeçalho formatado"""
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def print_result(success: bool, message: str):
    """Imprime resultado formatado"""
    status = "✅" if success else "❌"
    print(f"{status} {message}")


def test_health():
    """Testa endpoint GET /health"""
    print_header("Teste: Health Check")
    
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        data = response.json()
        
        if response.status_code == 200 and data.get("status") == "ok":
            print_result(True, f"Status: {response.status_code}")
            print_result(True, f"Resposta: {json.dumps(data)}")
            return True
        else:
            print_result(False, f"Status inesperado: {response.status_code}")
            print_result(False, f"Resposta: {json.dumps(data)}")
            return False
    except requests.exceptions.ConnectionError:
        print_result(False, f"Servidor não está rodando em {BASE_URL}")
        print("\n  Inicie o servidor com:")
        print("    python -m esoccer_voice.api.server")
        return False
    except Exception as e:
        print_result(False, f"Erro: {e}")
        return False


def test_models_download():
    """Testa endpoint POST /models/download"""
    print_header("Teste: Download de Modelos")
    
    try:
        print("Iniciando download/verificação de modelos...")
        print("(Isso pode demorar alguns minutos na primeira execução)\n")
        
        start_time = time.time()
        response = requests.post(f"{BASE_URL}/models/download", timeout=300)
        elapsed = time.time() - start_time
        
        data = response.json()
        
        print_result(True, f"Status: {response.status_code} (em {elapsed:.1f}s)")
        print_result(data.get("whisperReady", False), f"Whisper: {'Pronto' if data.get('whisperReady') else 'Não pronto'}")
        print_result(data.get("kokoroReady", False), f"Kokoro: {'Pronto' if data.get('kokoroReady') else 'Não pronto'}")
        
        return data.get("whisperReady") and data.get("kokoroReady")
    except Exception as e:
        print_result(False, f"Erro: {e}")
        return False


def create_test_audio(filename: str = "test_audio.wav", duration_ms: int = 1000):
    """Cria arquivo de áudio de teste"""
    sample_rate = 44100
    num_samples = int(sample_rate * duration_ms / 1000)
    amplitude = 32767 * 0.3
    frequency = 440
    
    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        
        for i in range(num_samples):
            t = i / sample_rate
            envelope = min(1.0, i / (sample_rate * 0.05), (num_samples - i) / (sample_rate * 0.05))
            sample = int(amplitude * envelope * math.sin(2 * math.pi * frequency * t))
            wav_file.writeframes(struct.pack('<h', sample))
    
    return filename


def test_stt():
    """Testa endpoint POST /stt"""
    print_header("Teste: Speech-to-Text (STT)")
    
    try:
        # Cria áudio de teste
        test_file = create_test_audio()
        print(f"Arquivo de teste criado: {test_file}")
        
        with open(test_file, 'rb') as f:
            files = {'audio': ('test.wav', f, 'audio/wav')}
            
            start_time = time.time()
            response = requests.post(f"{BASE_URL}/stt", files=files, timeout=60)
            elapsed = time.time() - start_time
        
        # Remove arquivo temporário
        Path(test_file).unlink()
        
        if response.status_code == 200:
            data = response.json()
            print_result(True, f"Status: {response.status_code} (em {elapsed:.1f}s)")
            print_result(True, f"Transcrição: \"{data.get('text', '')}\"")
            return True
        else:
            print_result(False, f"Status: {response.status_code}")
            print(f"  Resposta: {response.text[:200]}")
            return False
    except Exception as e:
        print_result(False, f"Erro: {e}")
        return False


def test_tts():
    """Testa endpoint POST /tts"""
    print_header("Teste: Text-to-Speech (TTS)")
    
    test_texts = [
        "Volta de seis minutos",
        "Gol do Brasil!",
        "Resultado: três a dois",
    ]
    
    all_success = True
    
    for text in test_texts:
        try:
            start_time = time.time()
            response = requests.post(
                f"{BASE_URL}/tts",
                json={"text": text},
                timeout=60
            )
            elapsed = time.time() - start_time
            
            if response.status_code == 200:
                content_type = response.headers.get('content-type', '')
                audio_size = len(response.content)
                
                # Verifica header WAV
                is_valid_wav = response.content[:4] == b'RIFF'
                
                print_result(is_valid_wav, f"\"{text}\"")
                print(f"      Status: {response.status_code}, Tamanho: {audio_size} bytes, Tempo: {elapsed:.1f}s")
                
                if not is_valid_wav:
                    all_success = False
            else:
                print_result(False, f"\"{text}\" - Status: {response.status_code}")
                all_success = False
        except Exception as e:
            print_result(False, f"\"{text}\" - Erro: {e}")
            all_success = False
    
    return all_success


def test_tts_save_file():
    """Gera e salva um arquivo de áudio TTS"""
    print_header("Teste: Salvar áudio TTS")
    
    text = "E-Soccer Battle. Volta de seis minutos. Prepare-se!"
    output_file = "output_tts.wav"
    
    try:
        response = requests.post(
            f"{BASE_URL}/tts",
            json={"text": text},
            timeout=60
        )
        
        if response.status_code == 200 and response.content[:4] == b'RIFF':
            with open(output_file, 'wb') as f:
                f.write(response.content)
            
            print_result(True, f"Áudio salvo em: {output_file}")
            print(f"      Texto: \"{text}\"")
            print(f"      Tamanho: {len(response.content)} bytes")
            return True
        else:
            print_result(False, f"Falha ao gerar áudio")
            return False
    except Exception as e:
        print_result(False, f"Erro: {e}")
        return False


def main():
    """Executa todos os testes"""
    print("\n" + "#" * 60)
    print("#  E-SOCCER BATTLE - Voice Engine Demo")
    print("#" * 60)
    print(f"\nServidor: {BASE_URL}")
    
    results = {}
    
    # Teste de health primeiro
    results['health'] = test_health()
    
    if not results['health']:
        print("\n" + "⚠️ " * 20)
        print("  AVISO: Servidor não está respondendo!")
        print("  Inicie o servidor antes de executar os testes.")
        print("⚠️ " * 20)
        return 1
    
    # Testes restantes
    results['models'] = test_models_download()
    results['stt'] = test_stt()
    results['tts'] = test_tts()
    results['tts_save'] = test_tts_save_file()
    
    # Sumário
    print_header("Sumário dos Testes")
    
    total = len(results)
    passed = sum(1 for v in results.values() if v)
    
    for test_name, success in results.items():
        print_result(success, test_name.upper())
    
    print(f"\n  Resultado: {passed}/{total} testes passaram")
    
    if passed == total:
        print("\n  \U0001F389 Todos os testes passaram!")
        return 0
    else:
        print("\n  \U0001F6A8 Alguns testes falharam.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
