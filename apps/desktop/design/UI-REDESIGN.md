# E-Soccer Battle V2 — UI Redesign Spec

**Estilo:** Painel de narração esportiva (ESPN/BandSports). Dark, energético, profissional.

---

## 1. Design System

| Token | Valor | Tailwind |
|---|---|---|
| **bg-primary** | `#0B0F1A` | `bg-[#0B0F1A]` |
| **bg-card** | `#131825` | `bg-[#131825]` |
| **bg-elevated** | `#1A2035` | `bg-[#1A2035]` |
| **accent-green** | `#00FF87` (ao vivo) | `text-[#00FF87]` |
| **accent-red** | `#FF3B5C` (grave/mic) | `text-[#FF3B5C]` |
| **accent-gold** | `#FFD700` (gol/destaque) | `text-[#FFD700]` |
| **accent-blue** | `#3B82F6` (info/links) | `text-blue-400` |
| **text-primary** | `#F1F5F9` | `text-slate-100` |
| **text-muted** | `#64748B` | `text-slate-500` |
| **border** | `rgba(255,255,255,0.06)` | `border-white/[0.06]` |
| **Font** | Inter (headings: 700, body: 400) | `font-sans` |

---

## 2. Layout — Grid Fixo

```
┌──────────────── Header ─────────────────┐
│ ⚽ E-SOCcer BATTLE   [status] [history] │
├────────────┬───────────────────┬────────┤
│            │                   │        │
│  Sidebar   │   ScoreBoard      │  Info  │
│  Histórico │   (central)       │  Panel │
│  Cmds      │                   │        │
│            │                   │        │
├────────────┴───────────────────┴────────┤
│  VoiceIndicator (bar fixa)     [text]  │
└────────────────────────────────────────┘
```

- **Grid:** `grid grid-cols-[280px_1fr_220px]` no desktop, `grid-cols-1` mobile
- **Sidebar:** scrollável, max-height calc(100vh - header - footer)
- **ScoreBoard:** ocupa centro, hero visual da tela
- **Footer:** fixo bottom, voice bar + text input inline

---

## 3. ScoreBoard — Redesign

Visual tipo placar TV esportivo. Full-width, sem card wrapper.

```
┌──────────────────────────────────────────┐
│   TIME A         3 × 2         TIME B   │
│   ██████         Volta 6        ██████   │
│                  ⏱ 04:32                  │
│            ● AO VIVO ●                   │
└──────────────────────────────────────────┘
```

- **Placar:** `text-8xl font-black tabular-nums` com gradiente (Time A: azul, Time B: vermelho)
- **Separador:** `text-6xl text-slate-600 font-light`
- **Nome times:** `text-xl font-bold tracking-wider uppercase`
- **Badge AO VIVO:** pill vermelho pulsante `bg-[#FF3B5C] animate-pulse` quando `emAndamento`
- **Período:** badge inferior `bg-white/10 rounded-full px-4 py-1 text-sm`
- **Cronômetro:** `font-mono text-2xl tabular-nums text-[#00FF87]` quando vivo
- **Gol flash:** overlay `animate-[flash_0.5s_ease-out]` — background gold flash no score que mudou

---

## 4. VoiceIndicator — Bar Fixa

Desce do card lateral para barra fixa no footer. Design minimal.

- **Idle:** ícone mic `text-slate-500`, hint "Clique para falar"
- **Listening:** ícone red com 2 rings pulsando (`animate-ping`), ondas sonoras (12 barras com `animate-[wave_1s_ease-in-out_infinite]` delay escalonado)
- **Recognized:** flash verde rápido no botão + texto interim em `text-[#00FF87]`
- **Error:** shake animation + tooltip vermelho

Text input ao lado direito do mic — `bg-white/5 border border-white/10 rounded-xl placeholder-slate-600`

---

## 5. CommandHistory — Sidebar

Lista vertical com ícones e timestamps.

- Cada entry: `flex gap-3 p-3 rounded-lg hover:bg-white/5 transition`
- **Ícone por tipo:** ⏱ volta, ⏸ intervalo, ❌ encerrar, ❓ dúvida, ✅ resultado
- **Timestamp:** `text-slate-600 text-xs font-mono` alinhado direita
- **Comando:** `text-slate-300 text-sm font-mono` com highlight azul na palavra-chave
- **Resposta:** `text-slate-500 text-xs` truncada 2 linhas
- **Último comando:** borda esquerda `border-l-2 border-[#00FF87]` + bg `bg-[#00FF87]/5`
- **Scroll:** scrollbar custom thin, `overflow-y-auto`

---

## 6. StatusBar — Footer Bar

Barra horizontal compacta abaixo do voice indicator.

```
🌐 Chrome 64bit │ 🎤 WebSpeech OK │ 📡 Backend Online │ Volta 6 │ ⏱ 04:32
```

- Ícone + label por status, separados por `│`
- Cores: verde (ok), amarelo (degradado), vermelho (offline)
- `text-xs text-slate-500 font-mono` em linha horizontal

---

## 7. Telas

| Tela | Descrição |
|---|---|
| **Loading** | BG dark, logo ⚽ center, spinner `animate-spin`, "Preparando narração..." |
| **Pronto** | ScoreBoard vazio com CTA: "Diga **volta seis** para iniciar". Mic pronto. |
| **Jogando** | ScoreBoard ativo, AO VIVO badge, voice bar listening, sidebar populating |
| **Intervalo** | ScoreBoard com badge "⏸ INTERVALO" amarelo, cronômetro pausado |
| **Encerrado** | ScoreBoard com badge "ENCERRADO" vermelho, placar final destacado, resumo na sidebar |

---

## 8. Animações

| Elemento | Trigger | CSS |
|---|---|---|
| **Mic pulse** | Listening | `animate-ping` ring + `scale-105` |
| **Sound wave** | Listening | 12 barras `h-[random]px` com stagger delay |
| **Gol flash** | Score change | `@keyframes flash { 0% {bg:gold, scale:1.2} 100% {bg:transparent, scale:1} }` 500ms |
| **Command entry** | New command | `slideInLeft` + fadeIn 300ms |
| **Badge status** | State change | `transition-colors duration-300` |
| **Score number** | Score change | `scale-125 text-gold` → `scale-100` 300ms ease-out |

---

## 9. Estados — Component Matrix

| Estado | ScoreBoard | VoiceIndicator | CommandHistory | StatusBar |
|---|---|---|---|---|
| **Loading** | Skeleton | Disabled | Empty | Gray dots |
| **Pronto** | Empty + CTA | Idle | Empty | All green |
| **Jogando** | Ativo + AO VIVO | Listening | Populating | Timer active |
| **Intervalo** | Pausado + badge | Idle | Pausado label | Timer paused |
| **Encerrado** | Final + ENCERRADO | Idle | Resumo completo | Timer stopped |

---

*Máximo 200 linhas. Pronto para implementação React + TailwindCSS.* 🎨⚽
