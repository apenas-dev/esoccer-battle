/**
 * Encerrar Handler - Ends the current match
 * Single Responsibility: Only handles match termination
 */

import { Match } from '../../entities/Match';
import { MatchStorePort } from '../../ports/MatchStorePort';

export interface EncerrarResult {
  success: boolean;
  match: Match | null;
  message: string;
  requiresConfirmation: boolean;
}

export async function handleEncerrar(
  matchStore: MatchStorePort,
  confirmed: boolean = false
): Promise<EncerrarResult> {
  const currentMatch = await matchStore.getCurrentMatch();

  if (!currentMatch) {
    return {
      success: false,
      match: null,
      message: 'Nenhuma partida para encerrar.',
      requiresConfirmation: false,
    };
  }

  if (currentMatch.status === 'encerrado') {
    return {
      success: false,
      match: currentMatch,
      message: 'Partida já está encerrada.',
      requiresConfirmation: false,
    };
  }

  // Request confirmation if not yet confirmed
  if (!confirmed) {
    return {
      success: false,
      match: currentMatch,
      message: 'Deseja encerrar a partida? Diga encerrar novamente para confirmar.',
      requiresConfirmation: true,
    };
  }

  // End the match
  currentMatch.status = 'encerrado';
  currentMatch.endedAt = new Date();
  const updatedMatch = await matchStore.updateMatch(currentMatch);

  const scoreA = updatedMatch.scoreA;
  const scoreB = updatedMatch.scoreB;

  return {
    success: true,
    match: updatedMatch,
    message: `Partida encerrada! Placar final: Time A ${scoreA}, Time B ${scoreB}.`,
    requiresConfirmation: false,
  };
}
