/**
 * Resultado Handler - Announces current score
 * Single Responsibility: Only handles score announcement
 */

import { Match } from '../../entities/Match';
import { MatchStorePort } from '../../ports/MatchStorePort';

export interface ResultadoResult {
  success: boolean;
  match: Match | null;
  message: string;
}

/**
 * Convert number to Portuguese word for score announcement
 */
function numberToPortuguese(n: number): string {
  const words = [
    'zero', 'um', 'dois', 'três', 'quatro', 'cinco',
    'seis', 'sete', 'oito', 'nove', 'dez',
    'onze', 'doze', 'treze', 'quatorze', 'quinze',
  ];
  return n >= 0 && n < words.length ? words[n] : n.toString();
}

export async function handleResultado(
  matchStore: MatchStorePort
): Promise<ResultadoResult> {
  const currentMatch = await matchStore.getCurrentMatch();

  if (!currentMatch) {
    return {
      success: false,
      match: null,
      message: 'Nenhuma partida em andamento.',
    };
  }

  const scoreAWord = numberToPortuguese(currentMatch.scoreA);
  const scoreBWord = numberToPortuguese(currentMatch.scoreB);

  return {
    success: true,
    match: currentMatch,
    message: `Time A ${scoreAWord}, Time B ${scoreBWord}.`,
  };
}
