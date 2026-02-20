/**
 * DuvidaAgora Handler - Marks current moment for later review
 * Single Responsibility: Only handles doubt registration
 */

import { Doubt } from '../../entities/Doubt';
import { MatchStorePort } from '../../ports/MatchStorePort';
import { DoubtStorePort } from '../../ports/DoubtStorePort';

export interface DuvidaAgoraResult {
  success: boolean;
  doubt: Doubt | null;
  message: string;
}

export async function handleDuvidaAgora(
  matchStore: MatchStorePort,
  doubtStore: DoubtStorePort
): Promise<DuvidaAgoraResult> {
  const currentMatch = await matchStore.getCurrentMatch();

  if (!currentMatch) {
    return {
      success: false,
      doubt: null,
      message: 'Nenhuma partida em andamento para registrar dúvida.',
    };
  }

  if (currentMatch.status === 'encerrado') {
    return {
      success: false,
      doubt: null,
      message: 'Partida já encerrada. Não é possível registrar dúvidas.',
    };
  }

  const timestamp = new Date().toLocaleTimeString('pt-BR');
  const description = `Momento marcado às ${timestamp}`;
  const doubt = await doubtStore.createDoubt(currentMatch.id, description);

  return {
    success: true,
    doubt,
    message: 'Dúvida registrada! Momento marcado para revisão.',
  };
}
