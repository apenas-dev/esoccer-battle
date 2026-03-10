# ⚽ E-Soccer Battle

> Aplicação desktop para narração e controle de partidas de e-soccer com comandos de voz, usando IA para transcrição (Whisper) e síntese de fala (Kokoro TTS).

---

## 📋 Pré-requisitos

| Ferramenta | Versão mínima | Verificar |
|---|---|---|
| **Node.js** | 18+ | `node --version` |
| **npm** | 9+ | `npm --version` |
| **Python** | 3.10+ | `python3 --version` |
| **Git** | qualquer | `git --version` |

### Somente Linux (desenvolvimento)

```bash
sudo apt install python3 python3-pip python3-venv
```

### Somente Windows (produção)

O Python é embutido automaticamente no instalador — o usuário final **não precisa instalar nada**.

---

## 🚀 Instalação Rápida

### 1. Clonar o repositório

```bash
git clone https://github.com/apenas-dev/esoccer-battle.git
cd esoccer-battle
```

### 2. Instalar dependências do frontend (Electron)

```bash
cd apps/desktop
npm install
```

### 3. Instalar dependências do backend (Python)

```bash
cd ../../backend/voice-engine
python3 -m venv .venv
source .venv/bin/activate        # Linux/macOS
# .venv\Scripts\activate         # Windows
pip install -r requirements.txt
```

> ⚠️ **PyTorch é pesado** (~2GB). A primeira instalação pode demorar bastante dependendo da sua conexão.

### 4. Rodar em desenvolvimento

```bash
# Terminal 1: Backend Python (dentro de backend/voice-engine com venv ativo)
uvicorn esoccer_voice.api.main:app --host 127.0.0.1 --port 8001 --reload

# Terminal 2: Frontend Electron (dentro de apps/desktop)
npm run dev
```

O app abre automaticamente. Na primeira execução, ele fará o download dos modelos de IA (~1GB).

---

## 📁 Estrutura do Projeto

```
esoccer-battle/
├── apps/
│   └── desktop/                 # Electron + React + TypeScript
│       ├── src/
│       │   ├── main/            # Processo principal (gerencia Python, IPC)
│       │   ├── preload/         # Bridge IPC segura
│       │   ├── renderer/        # UI React (componentes, hooks)
│       │   ├── core/            # Lógica de domínio (comandos, ports, adapters)
│       │   └── shared/          # Tipos compartilhados (SetupError, etc.)
│       ├── scripts/
│       │   └── prepare-python.js  # Empacota Python standalone p/ Windows
│       ├── electron-builder.yml   # Config do instalador
│       └── package.json
├── backend/
│   └── voice-engine/            # FastAPI + Whisper + Kokoro TTS
│       ├── esoccer_voice/
│       │   ├── api/             # Rotas FastAPI (health, tts, stt, models)
│       │   ├── stt/             # Speech-to-Text (faster-whisper)
│       │   ├── tts/             # Text-to-Speech (Kokoro)
│       │   └── models/          # Download e gerenciamento de modelos
│       └── requirements.txt
└── .github/
    └── workflows/
        └── build-releases.yml   # CI/CD: build Windows + Linux
```

---

## 🛠️ Scripts Disponíveis

Todos executados a partir de `apps/desktop/`:

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o app em modo desenvolvimento |
| `npm run build` | Compila o frontend (Vite + Electron) |
| `npm run build:win` | Gera o instalador `.exe` para Windows |
| `npm run build:linux` | Gera `.AppImage`, `.deb` e `.tar.gz` |
| `npm run typecheck` | Verifica erros de TypeScript |
| `npm run test:e2e` | Roda testes E2E com Vitest |
| `npm run prepare:python` | Empacota Python standalone (para build Windows) |

---

## 🏗️ Build de Produção

### Windows (gera `.exe`)

```bash
cd apps/desktop
npm run build:win
# Saída em: apps/desktop/release/
```

Isso automaticamente:
1. Baixa o `python-build-standalone` (Python 3.10 portátil)
2. Instala todas as dependências Python dentro dele
3. Empacota tudo com o Electron via NSIS

### Linux (gera `.AppImage` / `.deb`)

```bash
cd apps/desktop
npm run build:linux
# Saída em: apps/desktop/release/
```

### CI/CD (GitHub Actions)

O push para `master` dispara automaticamente o build para Windows e Linux via GitHub Actions. Os artefatos ficam disponíveis na aba **Actions** do repositório.

---

## 🧪 Testes

```bash
cd apps/desktop

# Testes E2E do backend (Vitest)
npm run test:e2e

# Testes E2E de UI (Playwright)
npm run test:e2e:ui

# Type checking
npm run typecheck
```

---

## 🔧 Solução de Problemas

### "Python não encontrado" no dev

```bash
# Verifique se o Python está no PATH
python3 --version

# Se não estiver instalado (Ubuntu/Debian)
sudo apt install python3 python3-pip python3-venv
```

### "Módulo não encontrado" no backend

```bash
cd backend/voice-engine
source .venv/bin/activate
pip install -r requirements.txt
```

### Build do Windows falha no `prepare:python`

```bash
# Limpe e tente novamente
cd apps/desktop
rm -rf python-standalone .python-download-tmp
npm run prepare:python
```

### Logs do aplicativo

Os logs ficam em:
- **Windows:** `%APPDATA%/esoccer-battle/logs/`
- **Linux:** `~/.config/esoccer-battle/logs/`

---

## 📝 Convenções do Projeto

- **Código:** TypeScript com camelCase
- **Princípios:** SOLID + KISS
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`)
- **Branches:** `master` (principal), feature branches para PRs

---

## 📄 Licença

MIT © E-Soccer Battle Team
