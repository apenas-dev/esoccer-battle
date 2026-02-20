/**
 * Intervalo Handler - Pauses or resumes match
 * Single Responsibility: Only handles pause/resume logic
 */

import { Match } from '../../entities/Match';
import { MatchStorePort } from '../../ports/MatchStorePort';

export interface IntervaloResult {
  success: boolean;
  match: Match | null;
  message: string;
  action: 'paused' | 'resumed' | 'none';
}

export async function handleIntervalo(
  matchStore: MatchStorePort
): Promise<IntervaloResult> {
  const currentMatch = await matchStore.getCurrentMatch();

  if (!currentMatch) {
    return {
      success: false,
      match: null,
      message: 'Nenhuma partida para pausar ou retomar.',
      action: 'none',
    };
  }

  if (currentMatch.status === 'emAndamento') {
    // Pause the match
    currentMatch.status = 'pausado';
    const updatedMatch = await matchStore.updateMatch(currentMatch);
    return {
      success: true,
      match: updatedMatch,
      message: 'Partida pausada. Diga intervalo para retomar.',
      action: 'paused',
    };
  }

  if (currentMatch.status === 'pausado') {
    // Resume the match
    currentMatch.status = 'emAndamento';
    const updatedMatch = await matchStore.updateMatch(currentMatch);
    return {
      success: true,
      match: updatedMatch,
      message: 'Partida retomada!',
      action: 'resumed',
    };
  }

  return {
    success: false,
    match: currentMatch,
    message: `Não é possível pausar partida com status: ${currentMatch.status}`,
    action: 'none',
  };
}
