# E-Soccer Battle Desktop App ⚽🎮

Aplicativo desktop para controle de partidas de E-Soccer com comandos de voz, seguindo o formato "Volta 6 Minutos".

## 📋 Requisitos do Sistema

### Obrigatórios

- **Node.js**: 18.0.0 ou superior
- **pnpm**: 8.0.0 ou superior (recomendado) ou npm
- **Python**: 3.8 ou superior
- **pip**: Gerenciador de pacotes Python

### Hardware Recomendado

- **RAM**: 8GB+ (modelos de IA consomem memória)
- **Armazenamento**: 2GB+ livres (download de modelos ~1GB)
- **Microfone**: Para comandos de voz
- **Alto-falantes**: Para respostas de áudio

## 🚀 Instalação

### 1. Clonar o Repositório

```bash
git clone <repo-url>
cd esoccer-battle
```

### 2. Instalar Dependências do Frontend

```bash
cd apps/desktop
pnpm install
```

### 3. Instalar Backend Python

```bash
cd ../../backend/voice-engine
pip install -e .
# ou
python -m pip install -e .
```

### 4. Download de Modelos de IA (~1GB)

Na primeira execução, os modelos serão baixados automaticamente. Alternativamente, execute manualmente:

```bash
cd backend/voice-engine
python -c "from esoccer_voice.models.downloader import ModelDownloader; ModelDownloader().downloadAllModels()"
```

**Modelos utilizados:**
- **Whisper large-v3-turbo** (~500MB): Speech-to-Text em português
- **Kokoro 82M** (~500MB): Text-to-Speech com voz natural

## 💻 Execução em Desenvolvimento

### Modo Completo (Recomendado)

```bash
# Terminal 1: Inicie o backend Python
cd backend/voice-engine
python -m esoccer_voice.api.main

# Terminal 2: Inicie o Electron
cd apps/desktop
pnpm dev
```

### Somente Frontend (Funcionalidade Limitada)

```bash
cd apps/desktop
pnpm dev
```

O app iniciará com o backend offline, permitindo testar a interface.

## 📦 Build para Distribuição

### Windows

```bash
cd apps/desktop
pnpm build:win
```

**Artefatos gerados em `release/`:**
- `E-Soccer Battle-x.x.x-portable.exe` - Versão portátil (sem instalação)
- `E-Soccer Battle Setup x.x.x.exe` - Instalador NSIS

### Linux

```bash
cd apps/desktop
pnpm build:linux
```

**Artefatos gerados em `release/`:**
- `E-Soccer Battle-x.x.x.AppImage` - AppImage universal
- `e-soccer-battle_x.x.x_amd64.deb` - Pacote Debian/Ubuntu

### Ambas Plataformas

```bash
cd apps/desktop
pnpm build:all
```

## 🎤 Comandos de Voz Disponíveis

| Comando | Descrição |
|---------|-----------|
| `"volta seis minutos"` | Inicia nova partida de 6 minutos |
| `"gol do time A"` | Marca gol para o Time A |
| `"gol do time B"` | Marca gol para o Time B |
| `"qual é o resultado"` | Anuncia o placar atual |
| `"intervalo"` | Pausa/retoma a partida |
| `"dúvida agora"` | Registra momento de revisão |
| `"encerrar partida"` | Finaliza a partida (pede confirmação) |
| `"comandos de voz"` | Lista todos os comandos |

### Dicas para Reconhecimento

- Fale claramente e em velocidade normal
- Evite ruídos de fundo
- Aguarde o indicador "Escutando..." antes de falar
- Comandos são processados em português brasileiro

## 🔧 Troubleshooting

### ❌ Erro "Electron uninstall" ou "Cannot find module 'electron'"

Este erro ocorre quando o Electron não foi instalado corretamente. Siga os passos:

```bash
# 1. Limpe a instalação anterior
cd apps/desktop
rm -rf node_modules
rm -f pnpm-lock.yaml  # ou yarn.lock / package-lock.json

# 2. Verifique se o caminho não tem espaços
# ⚠️ IMPORTANTE: Evite caminhos como "/home/user/Meus Projetos/esoccer-battle"
# Use caminhos sem espaços: "/home/user/projetos/esoccer-battle"

# 3. Reinstale as dependências
pnpm install

# 4. Se ainda falhar, force a reinstalação do Electron
pnpm add -D electron@28.1.0 --force

# 5. Rebuild de módulos nativos
pnpm rebuild
```

### ❌ Erro "better-sqlite3" ou módulos nativos

```bash
# Rebuild específico para módulos nativos
cd apps/desktop
pnpm rebuild

# Ou manualmente:
npx @electron/rebuild -f -w better-sqlite3
```

### ❌ Erro de permissão durante instalação

```bash
# Linux/macOS: NÃO use sudo com pnpm/npm
# Se precisou usar sudo antes, limpe o cache:
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) ~/.pnpm-store

# Reinstale normalmente (sem sudo)
pnpm install
```

### ❌ Instalação completa do zero

```bash
# Script de reinstalação completa
cd apps/desktop
pnpm reinstall
# ou manualmente:
rm -rf node_modules dist dist-electron
pnpm install
```

### Backend não inicia

1. Verifique se Python está no PATH:
   ```bash
   python3 --version
   # ou
   python --version
   ```

2. Reinstale as dependências:
   ```bash
   cd backend/voice-engine
   pip install -e . --force-reinstall
   ```

### Modelos não carregam

1. Verifique espaço em disco (precisa ~2GB)
2. Delete a pasta de cache e tente novamente:
   ```bash
   rm -rf ~/.cache/huggingface/hub/*whisper*
   rm -rf ~/.cache/huggingface/hub/*kokoro*
   ```

### Microfone não funciona

1. Verifique permissões do navegador/Electron
2. Teste em outro aplicativo
3. Selecione o microfone correto nas configurações do sistema

### Erro "ENOENT: no such file or directory"

1. Verifique se todas as dependências foram instaladas
2. Execute `pnpm install` novamente
3. Reconstrua com `pnpm build`

### Tela branca ou erro de renderização

1. Desative aceleração de hardware:
   ```bash
   # Já configurado por padrão no app
   app.disableHardwareAcceleration()
   ```

## 🏗️ Arquitetura

```
apps/desktop/
├── src/
│   ├── main/           # Processo principal Electron
│   │   └── index.ts    # Lifecycle + Python backend
│   ├── preload/        # Bridge entre main e renderer
│   │   └── index.ts    # API exposta para renderer
│   ├── renderer/       # Interface React
│   │   ├── App.tsx     # Componente principal
│   │   ├── components/ # Componentes de UI
│   │   └── hooks/      # React hooks
│   └── core/           # Domínio da aplicação
│       ├── entities/   # Match, Command, Doubt
│       ├── ports/      # Interfaces (DIP)
│       ├── commands/   # Command handlers
│       ├── stores/     # Persistência (SQLite)
│       └── adapters/   # Python STT/TTS
├── build/              # Recursos de build (ícones)
├── electron-builder.yml
└── package.json
```

## 📝 Convenções de Desenvolvimento

- **SOLID**: Single Responsibility, Open/Closed, Liskov, Interface Segregation, Dependency Inversion
- **KISS**: Keep It Simple, Stupid
- **DIP**: Dependency Inversion Principle (interfaces em `ports/`)
- **camelCase**: Para variáveis, funções e arquivos TypeScript
- **snake_case**: Para código Python

## 🧪 Testes

### E2E Tests

```bash
# Requer backend Python rodando
pnpm test:e2e
```

### Type Checking

```bash
pnpm typecheck
```

## 📄 Licença

MIT License - Veja [LICENSE](../../LICENSE) para detalhes.

## 🤝 Contribuindo

1. Fork o repositório
2. Crie uma branch (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

---

**E-Soccer Battle v0.1.0** | Iteração 3 | SQLite + Python Voice Engine
