/**
 * Handler for the 'adicionarPontoTimeA' command
 * Increments the score of Team A
 */

import type { MatchStorePort } from '../../ports/MatchStorePort';

export interface AdicionarPontoTimeAResult {
    message: string;
}

export async function handleAdicionarPontoTimeA(
    matchStore: MatchStorePort
): Promise<AdicionarPontoTimeAResult> {
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
    match.scoreA += 1;
    await matchStore.updateMatch(match);

    return {
        message: `Ponto para o time A! Placar parcial: Time A ${match.scoreA}, Time B ${match.scoreB}.`,
    };
}
