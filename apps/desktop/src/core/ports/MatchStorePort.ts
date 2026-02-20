/**
 * Match Store Port (DIP - Dependency Inversion)
 * Repository interface for Match persistence
 */

import { Match } from '../entities/Match';

export interface MatchStorePort {
  createMatch(durationMinutes?: number): Promise<Match>;
  updateMatch(match: Match): Promise<Match>;
  getCurrentMatch(): Promise<Match | null>;
  getMatchById(id: string): Promise<Match | null>;
}
