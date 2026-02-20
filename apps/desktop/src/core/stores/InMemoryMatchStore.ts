/**
 * In-Memory Match Store - Implements MatchStorePort
 * 
 * SOLID: Implements interface defined by port
 * KISS: Simple Map-based storage
 */

import { Match, createMatch } from '../entities/Match';
import { MatchStorePort } from '../ports/MatchStorePort';

export class InMemoryMatchStore implements MatchStorePort {
  private matches: Map<string, Match> = new Map();
  private currentMatchId: string | null = null;

  async createMatch(durationMinutes: number = 6): Promise<Match> {
    const id = crypto.randomUUID();
    const match = createMatch(id, durationMinutes);
    this.matches.set(id, match);
    this.currentMatchId = id;
    return { ...match };
  }

  async updateMatch(match: Match): Promise<Match> {
    if (!this.matches.has(match.id)) {
      throw new Error(`Match not found: ${match.id}`);
    }
    this.matches.set(match.id, { ...match });
    return { ...match };
  }

  async getCurrentMatch(): Promise<Match | null> {
    if (!this.currentMatchId) return null;
    const match = this.matches.get(this.currentMatchId);
    return match ? { ...match } : null;
  }

  async getMatchById(id: string): Promise<Match | null> {
    const match = this.matches.get(id);
    return match ? { ...match } : null;
  }

  /**
   * Utility method for testing - clear all matches
   */
  clear(): void {
    this.matches.clear();
    this.currentMatchId = null;
  }
}
