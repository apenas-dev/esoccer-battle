/**
 * Doubt Store Port (DIP - Dependency Inversion)
 * Repository interface for Doubt persistence
 */

import { Doubt } from '../entities/Doubt';

export interface DoubtStorePort {
  createDoubt(matchId: string, description: string): Promise<Doubt>;
  listByMatch(matchId: string): Promise<Doubt[]>;
  resolveDoubt(id: string): Promise<Doubt | null>;
}
