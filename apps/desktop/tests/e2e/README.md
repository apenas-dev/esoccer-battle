# E2E Tests - E-Soccer Battle Desktop

Testes End-to-End completos para a aplicação E-Soccer Battle Volta 6 Minutos.

## Estrutura

```
tests/e2e/
├── backend/           # Testes de API do backend Python
│   ├── health.e2e.test.ts
│   ├── models-download.e2e.test.ts
│   ├── stt-basic.e2e.test.ts
│   └── tts-basic.e2e.test.ts
├── ui/                # Testes de UI com Playwright
│   ├── app-initialization.e2e.test.ts
│   ├── command-volta6.e2e.test.ts
│   ├── command-resultado.e2e.test.ts
│   ├── command-intervalo.e2e.test.ts
│   ├── command-duvida.e2e.test.ts
│   ├── command-encerrar.e2e.test.ts
│   ├── command-ajuda.e2e.test.ts
│   ├── full-flow.e2e.test.ts
│   ├── persistence.e2e.test.ts
│   ├── history.e2e.test.ts
│   └── tts-verification.e2e.test.ts
├── helpers/           # Funções auxiliares
│   ├── electronHelper.ts
│   ├── audioHelper.ts
│   ├── sqliteHelper.ts
│   ├── waitHelper.ts
│   └── index.ts
├── setup.ts           # Setup do Vitest
└── README.md          # Este arquivo
```

## Pré-requisitos

1. **Node.js 18+** instalado
2. **Python 3.10+** instalado com ambiente virtual
3. **Backend Python** configurado em `backend/voice-engine/`
4. **Modelos AI** baixados (Whisper + Kokoro)

## Como Rodar

### Testes de Backend (Vitest)

```bash
# Rodar todos os testes de backend
yarn test:e2e

# Rodar em modo watch
yarn test:e2e:watch
```

### Testes de UI (Playwright)

```bash
# Build do app primeiro
yarn build

# Rodar testes de UI
yarn test:e2e:ui

# Rodar com visualização (headed)
yarn test:e2e:ui:headed

# Rodar em modo debug
yarn test:e2e:ui:debug
```

### Todos os Testes

```bash
yarn test:e2e:all
```

## Arquivos de Áudio de Teste

Os arquivos de áudio estão em `test-assets/audio/`:

- `volta-seis.wav` - Comando "Volta 6"
- `resultado.wav` - Comando "Resultado"
- `intervalo.wav` - Comando "Intervalo"
- `duvida.wav` - Comando "Dúvida agora"
- `encerrar.wav` - Comando "Encerrar"
- `confirmar.wav` - Comando "Confirmar"
- `comandos.wav` - Comando "Comandos de voz"
- `test-tone.wav` - Tom de teste genérico

## Helpers Disponíveis

### electronHelper.ts
- `startPythonBackend()` - Inicia o servidor Python
- `stopPythonBackend()` - Para o servidor Python
- `startElectronApp()` - Inicia o app Electron
- `stopElectronApp()` - Para o app Electron
- `getBackendUrl()` - Retorna URL do backend

### audioHelper.ts
- `readAudioFile(path)` - Lê arquivo de áudio
- `readAudioAsBase64(path)` - Lê como Base64
- `getAudioPathForCommand(name)` - Retorna path do áudio por comando

### sqliteHelper.ts
- `getAllMatches()` - Retorna todas as partidas
- `getCurrentMatch()` - Retorna partida atual
- `getMatchCount()` - Conta partidas
- `clearTestData()` - Limpa dados de teste
- `verifyMatchIntegrity(match)` - Verifica integridade

### waitHelper.ts
- `sleep(ms)` - Aguarda N milissegundos
- `waitForCondition(fn, opts)` - Aguarda condição
- `waitForText(page, selector, text)` - Aguarda texto
- `retryOperation(fn, opts)` - Retry com backoff

## Timeouts

Os testes possuem timeouts adequados para processamento de áudio:

- **Teste individual**: 120 segundos (2 min)
- **Asserções**: 30 segundos
- **Backend health check**: 60 segundos

## Limpeza de Dados

Os testes limpam dados automaticamente entre execuções:

```typescript
// No beforeAll
sqliteHelper.clearTestData();

// No afterAll
sqliteHelper.clearTestData();
```

## Convenções

- **SOLID**: Princípios de responsabilidade única
- **KISS**: Simplicidade nas implementações
- **camelCase**: Nomenclatura de variáveis e funções

## Troubleshooting

### Backend não inicia
```bash
cd backend/voice-engine
python -m esoccer_voice.api.main
```

### Modelos não baixados
```bash
curl -X POST http://127.0.0.1:8001/models/download
```

### Electron não encontrado
```bash
yarn build
```

### Permissões de microfone
Os testes de UI podem precisar de permissões de microfone. Configure no sistema operacional.

## Relatórios

Os relatórios de teste são gerados em:
- `playwright-report/` - Relatório HTML do Playwright
- `tests/e2e/test-results/` - Screenshots e vídeos de falhas
