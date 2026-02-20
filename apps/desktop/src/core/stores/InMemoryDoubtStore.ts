/**
 * In-Memory Doubt Store - Implements DoubtStorePort
 * 
 * SOLID: Implements interface defined by port
 * KISS: Simple Map-based storage
 */

import { Doubt, createDoubt } from '../entities/Doubt';
import { DoubtStorePort } from '../ports/DoubtStorePort';

export class InMemoryDoubtStore implements DoubtStorePort {
  private doubts: Map<string, Doubt> = new Map();

  async createDoubt(matchId: string, description: string): Promise<Doubt> {
    const id = crypto.randomUUID();
    const doubt = createDoubt(id, matchId, description);
    this.doubts.set(id, doubt);
    return { ...doubt };
  }

  async listByMatch(matchId: string): Promise<Doubt[]> {
    return Array.from(this.doubts.values())
      .filter((doubt) => doubt.matchId === matchId)
      .map((doubt) => ({ ...doubt }));
  }

  async resolveDoubt(id: string): Promise<Doubt | null> {
    const doubt = this.doubts.get(id);
    if (!doubt) return null;

    doubt.resolved = true;
    this.doubts.set(id, doubt);
    return { ...doubt };
  }

  /**
   * Utility method for testing - clear all doubts
   */
  clear(): void {
    this.doubts.clear();
  }
}
