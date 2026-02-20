/**
 * Match entity representing a game session
 * Follows KISS: simple data structure with clear status states
 */

export type MatchStatus = 'aguardando' | 'emAndamento' | 'pausado' | 'encerrado';

export interface Match {
  id: string;
  status: MatchStatus;
  scoreA: number;
  scoreB: number;
  durationMinutes: number;
  startedAt: Date | null;
  endedAt: Date | null;
}

/**
 * Factory function to create a new match with default values
 */
export function createMatch(id: string, durationMinutes: number = 6): Match {
  return {
    id,
    status: 'aguardando',
    scoreA: 0,
    scoreB: 0,
    durationMinutes,
    startedAt: null,
    endedAt: null,
  };
}
