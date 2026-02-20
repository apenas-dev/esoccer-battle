/**
 * Command Parser - Identifies commands from transcribed text
 * KISS: Simple pattern matching for command recognition
 */

export type CommandId =
  | 'volta6'
  | 'resultado'
  | 'intervalo'
  | 'duvidaAgora'
  | 'encerrar'
  | 'comandosVoz'
  | 'adicionarPontoTimeA'
  | 'adicionarPontoTimeB'
  | 'unknown';

export interface ParsedCommand {
  commandId: CommandId;
  confidence: number;
  rawText: string;
  params?: Record<string, string | number>;
}

/**
 * Command patterns for recognition
 * Each pattern has keywords that trigger the command
 */
const commandPatterns: { commandId: CommandId; patterns: RegExp[] }[] = [
  {
    commandId: 'volta6',
    patterns: [
      /volta\s*(seis|6)/i,
      /iniciar\s*(partida|jogo)/i,
      /come[çc]ar\s*(partida|jogo)/i,
      /nova\s*partida/i,
    ],
  },
  {
    commandId: 'resultado',
    patterns: [
      /resultado/i,
      /placar/i,
      /como\s*(est[aá]|t[aá])\s*(o\s*)?(jogo|placar)/i,
      /qual\s*(o\s*)?(placar|resultado)/i,
    ],
  },
  {
    commandId: 'intervalo',
    patterns: [
      /intervalo/i,
      /pausar?/i,
      /pausa/i,
      /continuar/i,
      /retomar/i,
    ],
  },
  {
    commandId: 'duvidaAgora',
    patterns: [
      /d[uú]vida\s*(agora)?/i,
      /marcar\s*d[uú]vida/i,
      /revisar\s*depois/i,
      /moment[oa]\s*duvidoso/i,
    ],
  },
  {
    commandId: 'encerrar',
    patterns: [
      /encerrar/i,
      /finalizar/i,
      /terminar\s*(partida|jogo)?/i,
      /fim\s*(de\s*)?(jogo|partida)/i,
    ],
  },
  {
    commandId: 'comandosVoz',
    patterns: [
      /comandos\s*(de\s*)?(voz)?/i,
      /ajuda/i,
      /quais\s*(s[aã]o\s*)?(os\s*)?comandos/i,
      /lista\s*(de\s*)?comandos/i,
    ],
  },
  {
    commandId: 'adicionarPontoTimeA',
    patterns: [
      /gol\s*(para\s*)?(o\s*)?time\s*a/i,
      /ponto\s*(para\s*)?(o\s*)?time\s*a/i,
      /adicionar\s*pontua[çc][ãa]o\s*(para\s*)?(o\s*)?time\s*a/i,
      /marcar\s*gol\s*(para\s*)?(o\s*)?time\s*a/i,
    ],
  },
  {
    commandId: 'adicionarPontoTimeB',
    patterns: [
      /gol\s*(para\s*)?(o\s*)?time\s*b/i,
      /ponto\s*(para\s*)?(o\s*)?time\s*b/i,
      /adicionar\s*pontua[çc][ãa]o\s*(para\s*)?(o\s*)?time\s*b/i,
      /marcar\s*gol\s*(para\s*)?(o\s*)?time\s*b/i,
    ],
  },
];

/**
 * Parse transcribed text and identify the command
 */
export function parseCommand(text: string): ParsedCommand {
  const normalizedText = text.toLowerCase().trim();

  for (const { commandId, patterns } of commandPatterns) {
    for (const pattern of patterns) {
      if (pattern.test(normalizedText)) {
        return {
          commandId,
          confidence: 0.9,
          rawText: text,
        };
      }
    }
  }

  return {
    commandId: 'unknown',
    confidence: 0,
    rawText: text,
  };
}
