/**
 * Doubt entity representing a moment marked for later review
 * Simple structure for tracking disputed moments during matches
 */

export interface Doubt {
  id: string;
  matchId: string;
  description: string;
  createdAt: Date;
  resolved: boolean;
}

/**
 * Factory function to create a new doubt record
 */
export function createDoubt(
  id: string,
  matchId: string,
  description: string
): Doubt {
  return {
    id,
    matchId,
    description,
    createdAt: new Date(),
    resolved: false,
  };
}
