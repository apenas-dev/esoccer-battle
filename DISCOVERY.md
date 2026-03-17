# 🔍 DISCOVERY — esoccer-battle

> **Data:** 2026-03-17  
> **Repo:** https://github.com/apenas-dev/esoccer-battle.git  
> **Analisador:** Project Discovery Agent (subagent)

---

## 📐 Arquitetura

**Padrão:** Desktop híbrido Electron + Python backend, com arquitetura Hexagonal (Ports & Adapters).

```
┌──────────────────────────────────────────────────┐
│                  Electron App                     │
│  ┌─────────────┐  ┌───────────────────────────┐  │
│  │  Renderer    │  │  Preload (contextBridge)  │  │
│  │  (React UI)  │◄─┤  + Core Domain Logic      │  │
│  │  Tailwind    │  │  + SQLite Stores          │  │
│  │  Hooks       │  │  + Python Adapters        │  │
│  └─────────────┘  └───────────────────────────┘  │
│         │                      │ fetch/FormData    │
│         │              ┌───────▼────────┐         │
│         │              │ Python Backend  │         │
│         │              │ (FastAPI :8001) │         │
│         │              │ - Whisper STT  │         │
│         │              │ - Kokoro TTS   │         │
│         │              └────────────────┘         │
│  ┌──────┴──────────────────────────────────┐      │
│  │  Main Process (IPC, Python lifecycle)    │      │
│  └──────────────────────────────────────────┘      │
└──────────────────────────────────────────────────┘
```

### Camadas

| Camada | Tecnologia | Responsabilidade |
|---|---|---|
| **Main Process** | Electron `main` | Gerencia janela, ciclo de vida do Python backend, IPC handlers |
| **Preload** | Electron preload + Core TS | Expõe API ao renderer; contém **toda a lógica de domínio**, stores SQLite, adapters Python |
| **Renderer** | React 18 + Tailwind CSS | UI: scoreboard, voice indicator, command history, download/loading screens |
| **Backend Python** | FastAPI + faster-whisper + Kokoro TTS | STT (transcrição), TTS (síntese de voz), download de modelos |

---

## 🛠️ Stack Tecnológica

| Área | Stack |
|---|---|
| **Desktop Framework** | Electron 28.x |
| **Frontend** | React 18.2, TypeScript 5.3, Tailwind CSS 3.4 |
| **Build** | electron-vite 2.0, electron-builder 24.9 |
| **Banco de Dados** | better-sqlite3 12.x (WAL mode) |
| **Backend** | Python 3.10+, FastAPI, Uvicorn |
| **STT** | faster-whisper (Whisper large-v3-turbo, int8 CPU) |
| **TTS** | Kokoro 82M (voice: pf_dora PT-BR) |
| **CI/CD** | GitHub Actions (Windows + Linux builds) |
| **Testes** | Vitest (backend E2E), Playwright (UI E2E) |
| **Distribuição** | NSIS (Windows .exe), AppImage/.deb/.tar.gz (Linux) |

---

## 🏗️ Padrões Arquiteturais Identificados

### 1. Hexagonal Architecture (Ports & Adapters) — Confiança: 95%
- **Ports:** `MatchStorePort`, `VoiceTranscriberPort`, `VoiceSynthesizerPort`, `DoubtStorePort`, `CommandLogStorePort`
- **Adapters:** `SQLiteMatchStore`, `PythonVoiceSynthesizerAdapter`, `PythonVoiceTranscriberAdapter`, `InMemoryDoubtStore`
- Domain depende apenas de interfaces, não de implementações concretas

### 2. Command Pattern — Confiança: 92%
- `CommandEngine` orquestra parse → route → execute
- Cada handler é uma função pura com responsabilidade única
- 8 comandos: volta6, resultado, intervalo, duvidaAgora, encerrar, comandosVoz, adicionarPontoTimeA, adicionarPontoTimeB

### 3. Factory Functions — Confiança: 88%
- `createMatch()`, `createDoubt()`, `createCommandExecution()`, `createSetupError()`
- Criação de entidades centralizada

### 4. Singleton (Lazy) — Confiança: 85%
- `getWhisperEngine()`, `getKokoroEngine()`, `getModelDownloader()` — instância global com lazy init
- `getDatabase()` — instância SQLite compartilhada

---

## 🐛 Bugs

### BUG-001: Temporizador de partida nunca é implementado
- **Severidade:** High
- **Localização:** `volta6Handler.ts`, `CommandEngine.ts`, toda a aplicação
- **Descrição:** A partida é criada com `durationMinutes: 6` mas **nenhum timer/countdown** é implementado. A partida inicia com status `emAndamento` e nunca encerra automaticamente. O `startedAt` é registrado mas nunca consultado para verificar timeout.
- **Sugestão:** Implementar um timer no `CommandEngine` (ou hook React) que verifique `Date.now() - startedAt > 6 * 60 * 1000` e encerre automaticamente a partida, ou use `setInterval` para countdown.

### BUG-002: Confirmação de encerramento não reseta em timeout
- **Severidade:** Medium
- **Localização:** `CommandEngine.ts` — `pendingConfirmation`
- **Descrição:** `pendingConfirmation` é setado ao primeiro "encerrar", mas se o usuário disser outro comando qualquer entre a primeira e segunda chamada, o estado persiste. Somente o comando `encerrar` confirma; qualquer outro comando ignora a confirmação pendente sem limpá-la. Isso pode causar confusão — o usuário pode "encerrar" inesperadamente depois de várias interações.
- **Sugestão:** Adicionar lógica para limpar `pendingConfirmation` quando qualquer comando diferente de `encerrar` for executado, ou implementar timeout (ex: 30s) para expirar a confirmação.

### BUG-003: Sanitização de score ausente — risco de valores negativos
- **Severidade:** Medium
- **Localização:** `adicionarPontoTimeAHandler.ts`, `adicionarPontoTimeBHandler.ts`
- **Descrição:** Não há validação de上限para scores. Embora o handler apenas incremente `+1`, a entidade `Match` não tem proteção contra valores negativos se `updateMatch` for chamado diretamente com score negativo.
- **Sugestão:** Adicionar validação `scoreA = Math.max(0, match.scoreA)` no `MatchStore` ou `updateMatch`, ou usar um tipo que represente apenas non-negative integers.

### BUG-004: `voice-commands` pattern conflita com `comandos de voz`
- **Severidade:** Low
- **Localização:** `commandParser.ts`
- **Descrição:** O pattern `/comandos\s*(de\s*)?(voz)?/i` com o `?` no final faz com que a string "comandos" sozinha (sem "de voz") também dispare o comando. Isso pode causar falsos positivos se alguém disser algo como "os comandos do time A".
- **Sugestão:** Tornar "de voz" obrigatório ou adicionar word boundaries `\b` nos patterns.

### BUG-005: `audio/webm` não está na lista de allowedTypes no STT
- **Severidade:** Medium
- **Localização:** `routes.py` — endpoint `/stt`
- **Descrição:** O frontend envia áudio em formato WebM (MediaRecorder default no Chrome/Electron), e o header `audio/webm` está incluso na lista `allowedTypes`. Porém o content-type do Blob enviado pelo frontend pode ser `audio/webm;codecs=opus` ou `audio/webm;codecs=vp8,opus`, que **não** está na lista de allowedTypes. A validação por extensão salva, mas a validação por content-type pode rejeitar áudios válidos.
- **Sugestão:** Usar `file.content_type.startswith('audio/')` ou normalizar removendo parâmetros de codec.

### BUG-006: `numberToPortuguese` limitado a 0-15
- **Severidade:** Low
- **Localização:** `resultadoHandler.ts`
- **Descrição:** Se o placar exceder 15, a função retorna `n.toString()` (número em formato decimal) em vez da palavra por extenso, causando inconsistência na narração.
- **Sugestão:** Expandir o array até pelo menos 20-30, ou adicionar lógica para centenas.

---

## 🔒 Segurança

### SEC-001: CORS permite qualquer origem (`allow_origins=["*"]`)
- **Severidade:** High
- **Localização:** `main.py` — CORSMiddleware
- **Descrição:** O backend FastAPI escuta em `127.0.0.1:8001` com CORS aberto para todas as origens. Qualquer aplicação local pode fazer requisições ao backend. Embora seja localhost, isso é um risco em ambientes compartilhados ou se o usuário expor a porta.
- **Sugestão:** Restringir a `allow_origins` para `["http://localhost:*", "app://-*"]` ou similar, ou usar um token secreto nos headers.

### SEC-002: Sandbox desabilitado no BrowserWindow
- **Severidade:** Medium
- **Localização:** `index.ts` (main process) — `webPreferences.sandbox: false`
- **Descrição:** O preload script usa Node.js APIs (require, fs, crypto) diretamente, o que exige sandbox desabilitado. Isso aumenta a superfície de ataque — se houver XSS no renderer, o atacante ganha acesso ao Node.js.
- **Sugestão:** Mover toda lógica de domínio e acesso a recursos para o main process via IPC seguro. O preload deve ser apenas um bridge IPC (contextBridge), sem lógica de negócio.

### SEC-003: Sem autenticação no backend Python
- **Severidade:** Medium
- **Localização:** `routes.py` — todos os endpoints
- **Descrição:** O backend não tem qualquer forma de autenticação. Qualquer processo na máquina pode acessar `/stt`, `/tts`, `/models/download`. Em particular, `/models/download` inicia download de ~1GB de modelos, o que pode ser abusado.
- **Sugestão:** Adicionar API key ou token de sessão gerado pelo Electron main process e passado como header nas requisições.

### SEC-004: Preload expõe lógica de domínio completa ao renderer
- **Severidade:** High
- **Localização:** `preload/index.ts`
- **Descrição:** O preload script inicializa e expõe ao renderer: `SQLiteMatchStore`, `SQLiteCommandLogStore`, `InMemoryDoubtStore`, `PythonVoiceTranscriberAdapter`, `PythonVoiceSynthesizerAdapter`, `CommandEngine`. Toda a lógica de negócio roda no processo renderer com acesso total ao SQLite e fetch. Isso viola o princípio de最小 privilégio do Electron.
- **Sugestão:** Mover stores e command engine para o main process. O preload deve expor apenas funções IPC `invoke/handle`.

### SEC-005: `execSync` para detectar Python
- **Severidade:** Low
- **Localização:** `index.ts` — `getPythonCmd()`
- **Descrição:** Usa `execSync` para executar `python3 --version` e `python --version`. Embora o timeout de 3s mitigue, `execSync` bloqueia o event loop. Em um cenário de PATH hijacking, isso pode executar código arbitrário.
- **Sugestão:** Usar `spawnSync` (já usado em outros lugares) e validar o camheiro absoluto do Python.

---

## 📉 Débito Técnico

### DEBT-001: Toda lógica de domínio no preload (architectural)
- **Severidade:** High
- **Localização:** `preload/index.ts`
- **Descrição:** O preload script (~500 linhas) inicializa SQLite, adapters Python e CommandEngine, expondo-os via contextBridge. Isso é um anti-pattern no Electron — o preload deveria ser um thin bridge. Se o renderer for comprometido (XSS), o atacante tem acesso total ao SQLite e ao sistema de arquivos.
- **Sugestão:** Mover stores e engine para o main process, expor apenas IPC handlers no preload.

### DEBT-002: DoubtStore é in-memory (dados perdidos ao reiniciar)
- **Severidade:** Medium
- **Localização:** `InMemoryDoubtStore.ts`
- **Descrição:** Dúvidas são armazenadas em um Map na memória. Ao reiniciar o app, todas as dúvidas registradas são perdidas. Match e CommandLog usam SQLite, mas DoubtStore não.
- **Sugestão:** Criar `SQLiteDoubtStore` implementando `DoubtStorePort`.

### DEBT-003: Modelo Whisper é "large-v3-turbo" — pesado demais para CPU
- **Severidade:** Medium
- **Localização:** `whisper_engine.py`, `downloader.py`
- **Descrição:** O modelo `large-v3-turbo` (≈1.5GB) é o maior da família Whisper e é otimizado para GPU. Em CPU com int8, a transcrição pode levar 10-30s por clipe de áudio. Para comandos de voz curtos, `base` ou `small` seriam muito mais rápidos com qualidade aceitável.
- **Sugestão:** Usar `base` ou `small` para latência menor, ou permitir configuração do modelo pelo usuário.

### DEBT-004: Sem rate limiting no backend
- **Severidade:** Medium
- **Localização:** `routes.py` — todos os endpoints
- **Descrição:** Não há rate limiting. Um loop infinito de requisições TTS/STT pode sobrecarregar o sistema (CPU intensive). `/models/download` pode ser chamado múltiplas vezes em paralelo.
- **Sugestão:** Adicionar rate limiting básico via middleware FastAPI (ex: slowapi).

### DEBT-005: Sem checksum/validação de integridade dos modelos baixados
- **Severidade:** Medium
- **Localização:** `downloader.py`
- **Descrição:** Os modelos são baixados do HuggingFace sem validação de checksum. Um download corrompido ou um MITM pode resultar em modelos quebrados sem detecção.
- **Sugestão:** Validar SHA256 dos arquivos baixados contra valores conhecidos.

### DEBT-006: CI/CD cleanup deleta TODOS os artefatos
- **Severidade:** Low
- **Localização:** `.github/workflows/build-releases.yml` — job `cleanup`
- **Descrição:** O step de cleanup deleta TODOS os artefatos do repo antes de cada build. Isso destrói artefatos de builds anteriores que ainda possam ser necessários.
- **Sugestão:** Deletar apenas artefatos com mais de X dias, ou usar `retention-days` nos upload-artifact steps.

### DEBT-007: Gerenciador de pacotes inconsistente (npm vs pnpm vs yarn)
- **Severidade:** Low
- **Localização:** `package.json`
- **Descrição:** O `package.json` tem scripts que usam `pnpm run`, `npm run` e `yarn` misturados. Há tanto `pnpm-lock.yaml` quanto `yarn.lock`. Isso pode causar inconsistências de dependências.
- **Sugestão:** Padronizar em um único gerenciador. Recomendação: `pnpm` (já é o primary).

### DEBT-008: `build-python` copy model logic duplicated
- **Severidade:** Low
- **Localização:** `downloader.py`, `whisper_engine.py`
- **Descrição:** A lógica de determinação do diretório de modelos está duplicada entre `getModelsBaseDir()` e `getVoiceEnginePath()` no main process. Se um mudar, o outro pode ficar desincronizado.

---

## 💡 Melhorias Sugeridas

### IMPR-001: Implementar countdown/timer da partida
- **Prioridade:** High
- **Descrição:** A feature central do app ("Volta 6 Minutos") não tem timer. A partida nunca encerra automaticamente.
- **Sugestão:** Timer no CommandEngine ou hook React, com notificação de voz ao faltar 1 minuto e ao encerrar.

### IMPR-002: Adicionar match timer visual na UI
- **Prioridade:** High
- **Descrição:** Não há countdown visual no ScoreBoard. O usuário não sabe quanto tempo resta.
- **Sugestão:** Componente de timer com countdown regressivo, sincronizado com `startedAt` da partida.

### IMPR-003: Adicionar confirmação para "Gol" (score undo)
- **Prioridade:** Medium
- **Descrição:** Não há como desfazer um gol marcado erroneamente. Isso é crítico em uma partida real.
- **Sugestão:** Comando "desfazer" ou "tirar gol" para decrementar o último ponto.

### IMPR-004: Fallback TTS gera beep — sem utilidade
- **Prioridade:** Medium
- **Descrição:** Quando Kokoro não está disponível, o fallback gera um tom de 440Hz sem informação de voz. O usuário não recebe feedback textual.
- **Sugestão:** Usar TTS via browser (Web Speech API) como fallback, ou pelo menos mostrar o texto na UI.

### IMPR-005: Adicionar testes unitários para os handlers
- **Prioridade:** Medium
- **Descrição:** Existem testes E2E (Vitest + Playwright) mas não há testes unitários dos command handlers, que são funções puras ideais para testes.
- **Sugestão:** Testes unitários com InMemoryMatchStore para cada handler.

### IMPR-006: Adicionar logging estruturado no backend Python
- **Prioridade:** Low
- **Descrição:** O backend usa `logging.basicConfig` com formato simples. Para produção, seria útil ter JSON structured logging.
- **Sugestão:** Usar `structlog` ou Python `logging` com JSON formatter.

### IMPR-007: Suporte a customização de times (nomes)
- **Prioridade:** Low
- **Descrição:** Os times são hard-coded como "Time A" e "Time B".
- **Sugestão:** Permitir que o usuário defina nomes dos times antes da partida.

---

## 📊 Resumo

| Categoria | Critical | High | Medium | Low | Total |
|---|---|---|---|---|---|
| Bugs | 0 | 1 | 3 | 2 | 6 |
| Segurança | 0 | 2 | 2 | 1 | 5 |
| Débito Técnico | 0 | 1 | 5 | 2 | 8 |
| Melhorias | — | 2 | 2 | 3 | 7 |
| **Total** | **0** | **6** | **12** | **8** | **26** |

### Top 5 Prioridades

1. **IMPR-001/BUG-001** — Implementar timer de partida (feature central ausente)
2. **SEC-004/DEBT-001** — Mover lógica do preload para main process (segurança)
3. **SEC-001** — Restringir CORS do backend
4. **DEBT-003** — Reconsiderar modelo Whisper para CPU (performance)
5. **DEBT-002** — Migrar DoubtStore para SQLite (dados persistentes)

---

## ✏️ Correções Aplicadas (2026-03-17)

As seguintes correções foram feitas diretamente no código:

| ID | Arquivo | Correção |
|---|---|---|
| SEC-001 | `backend/voice-engine/esoccer_voice/api/main.py` | CORS restrito para `app://-`, `localhost`, `127.0.0.1` |
| SEC-002-fix | `apps/desktop/src/main/index.ts` | `stopPythonBackend()` — usa `taskkill /T /F` no Windows para matar process tree |
| BUG-005 | `backend/voice-engine/esoccer_voice/api/routes.py` | STT valida extensão primeiro, depois content-type sem codec params |
| CI-fix-1 | `.github/workflows/build-releases.yml` | Cache path corrigido: `package-lock.json` → `pnpm-lock.yaml` |
| CI-fix-2 | `.github/workflows/build-releases.yml` | Gerenciador padronizado: `npm` → `pnpm` em todo o workflow |
| Lifecycle | `apps/desktop/src/main/index.ts` | `before-quit` faz cleanup síncrono; `window-all-closed` não duplica kill |

---

## ✅ Pontos Positivos

- **Arquitetura limpa** com Ports & Adapters bem definidos
- **Boa separação** de entidades, ports, adapters, stores e handlers
- **SetupError** bem estruturado com categorias, recovery actions e i18n-friendly
- **Lógica de build** completa para Windows (embedded Python) e Linux
- **CI/CD funcional** com GitHub Actions
- **Documentação** decente no README
- **Fallbacks** implementados para quando o Python não está disponível
- **TTS com voz PT-BR** (Kokoro pf_dora) — diferencial para o público-alvo

---

*Gerado automaticamente pelo Project Discovery Agent*
