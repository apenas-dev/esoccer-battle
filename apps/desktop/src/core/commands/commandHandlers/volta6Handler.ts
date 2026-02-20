/**
 * Volta6 Handler - Starts a new 6-minute match
 * Single Responsibility: Only handles match initialization
 */

import { Match } from '../../entities/Match';
import { MatchStorePort } from '../../ports/MatchStorePort';

export interface Volta6Result {
  success: boolean;
  match: Match | null;
  message: string;
}

export async function handleVolta6(
  matchStore: MatchStorePort
): Promise<Volta6Result> {
  const currentMatch = await matchStore.getCurrentMatch();

  // Check if there's already an active match
  if (currentMatch && currentMatch.status === 'emAndamento') {
    return {
      success: false,
      match: currentMatch,
      message: 'Já existe uma partida em andamento. Encerre antes de iniciar outra.',
    };
  }

  // Create new match with 6 minutes duration
  const newMatch = await matchStore.createMatch(6);
  
  // Start the match
  newMatch.status = 'emAndamento';
  newMatch.startedAt = new Date();
  const updatedMatch = await matchStore.updateMatch(newMatch);

  return {
    success: true,
    match: updatedMatch,
    message: 'Volta seis! Partida iniciada.',
  };
}
