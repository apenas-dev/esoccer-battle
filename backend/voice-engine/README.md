# E-Soccer Voice Engine

Backend de processamento de voz para o E-Soccer Battle - STT (Speech-to-Text) com Whisper e TTS (Text-to-Speech) com Kokoro.

## 🎯 Funcionalidades

- **STT (Speech-to-Text)**: Transcrição de áudio usando Whisper Large V3 Turbo
- **TTS (Text-to-Speech)**: Síntese de voz usando Kokoro 82M com voz Dora PT-BR
- **API REST**: Endpoints FastAPI para integração com aplicativo desktop
- **Otimizado para CPU**: Configurado para rodar sem GPU

## 📋 Requisitos

- Python 3.10+
- FFmpeg (para processamento de áudio)
- ~6GB de espaço em disco para modelos

## 🚀 Instalação

### 1. Instalar FFmpeg

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y ffmpeg

# macOS
brew install ffmpeg

# Windows
# Baixar de https://ffmpeg.org/download.html
```

### 2. Criar ambiente virtual

```bash
cd /home/ubuntu/esoccer-battle/backend/voice-engine
python -m venv venv
source venv/bin/activate  # Linux/macOS
# ou: venv\Scripts\activate  # Windows
```

### 3. Instalar dependências

```bash
pip install -r requirements.txt
```

### 4. Baixar modelos

Os modelos serão baixados automaticamente na primeira execução ou via endpoint:

```bash
# Via API (após iniciar o servidor)
curl -X POST http://127.0.0.1:8001/models/download
```

## 🏃 Execução

### Iniciar o servidor

```bash
# Opção 1: Via uvicorn diretamente
cd /home/ubuntu/esoccer-battle/backend/voice-engine
uvicorn esoccer_voice.api.main:app --host 127.0.0.1 --port 8001

# Opção 2: Via módulo Python
python -m esoccer_voice.api.main
```

O servidor estará disponível em: `http://127.0.0.1:8001`

## 📖 API Endpoints

### Health Check
```http
GET /health
```
**Resposta:**
```json
{"status": "ok"}
```

### Download de Modelos
```http
POST /models/download
```
**Resposta:**
```json
{
  "whisperReady": true,
  "kokoroReady": true,
  "whisperMessage": "Whisper large-v3-turbo is ready",
  "kokoroMessage": "Kokoro 82M with Dora PT-BR voice is ready"
}
```

### Speech-to-Text (STT)
```http
POST /stt
Content-Type: multipart/form-data
```
**Parâmetros:**
- `file`: Arquivo de áudio (WAV, MP3, OGG)

**Resposta:**
```json
{"text": "texto transcrito do áudio"}
```

**Exemplo com curl:**
```bash
curl -X POST http://127.0.0.1:8001/stt \
  -F "file=@audio.wav"
```

### Text-to-Speech (TTS)
```http
POST /tts
Content-Type: application/json
```
**Body:**
```json
{"text": "Olá, bem-vindo ao E-Soccer Battle!"}
```

**Resposta:** Arquivo de áudio WAV (bytes)

**Exemplo com curl:**
```bash
curl -X POST http://127.0.0.1:8001/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Olá, bem-vindo ao E-Soccer Battle!"}' \
  --output speech.wav
```

## 📁 Estrutura do Projeto

```
voice-engine/
├── pyproject.toml          # Configuração do projeto
├── requirements.txt        # Dependências Python
├── README.md              # Este arquivo
├── esoccer_voice/         # Código fonte
│   ├── __init__.py
│   ├── api/               # API FastAPI
│   │   ├── __init__.py
│   │   ├── main.py        # Aplicação FastAPI
│   │   └── routes.py      # Rotas/endpoints
│   ├── stt/               # Speech-to-Text
│   │   ├── __init__.py
│   │   └── whisper_engine.py
│   ├── tts/               # Text-to-Speech
│   │   ├── __init__.py
│   │   └── kokoro_engine.py
│   └── models/            # Gerenciamento de modelos
│       ├── __init__.py
│       └── downloader.py
└── models/                # Modelos baixados (gitignore)
    ├── whisper/           # Whisper Large V3 Turbo
    └── kokoro/            # Kokoro 82M
```

## 🔧 Configuração

### Variáveis de Ambiente (opcional)

```bash
# Diretório para cache de modelos Hugging Face
export HF_HOME=/path/to/cache

# Nível de log
export LOG_LEVEL=INFO
```

## 📊 Modelos Utilizados

| Modelo | Tamanho | Uso | Idioma |
|--------|---------|-----|--------|
| Whisper Large V3 Turbo | ~1.5GB | STT | Multilíngue (PT-BR) |
| Kokoro 82M | ~160MB | TTS | PT-BR (voz Dora) |

## 🐛 Troubleshooting

### Erro: "faster-whisper not installed"
```bash
pip install faster-whisper
```

### Erro: "kokoro not installed"
```bash
pip install kokoro
```

### Erro de áudio não suportado
Certifique-se de que o FFmpeg está instalado:
```bash
ffmpeg -version
```

### Modelos não carregam
Verifique espaço em disco e conexão com internet. Os modelos são baixados do Hugging Face Hub.

## 📝 Convenções de Código

- **camelCase** para funções e variáveis
- **PascalCase** para classes
- Seguir princípios SOLID, KISS, DIP

## 📄 Licença

MIT License - Veja LICENSE para detalhes.
