/**
 * Handler for the 'adicionarPontoTimeB' command
 * Increments the score of Team B
 */

import type { MatchStorePort } from '../../ports/MatchStorePort';

export interface AdicionarPontoTimeBResult {
    message: string;
}

export async function handleAdicionarPontoTimeB(
    matchStore: MatchStorePort
): Promise<AdicionarPontoTimeBResult> {
    const match = await matchStore.getCurrentMatch();

    if (!match) {
        return {
            message: 'Nenhuma partida em andamento para adicionar ponto.',
        };
    }

    if (match.status !== 'emAndamento') {
        return {
            message: 'A partida não está em andamento. Não é possível adicionar ponto.',
        };
    }

    // Increment score
    match.scoreB += 1;
    await matchStore.updateMatch(match);

    return {
        message: `Ponto para o time B! Placar parcial: Time A ${match.scoreA}, Time B ${match.scoreB}.`,
    };
}
