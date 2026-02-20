/**
 * SQLite Match Store
 * Implements MatchStorePort using better-sqlite3
 * Follows SOLID (SRP, DIP) + KISS + camelCase
 */

import { MatchStorePort } from '../../ports/MatchStorePort';
import { Match, createMatch } from '../../entities/Match';
import { getDatabase } from './database';

export class SQLiteMatchStore implements MatchStorePort {
  /**
   * Creates a new match and sets it as current
   */
  async createMatch(durationMinutes: number = 6): Promise<Match> {
    const db = getDatabase();
    const id = crypto.randomUUID();
    const match = createMatch(id, durationMinutes);

    // Clear previous current match
    db.prepare('UPDATE matches SET isCurrent = 0 WHERE isCurrent = 1').run();

    // Insert new match as current
    db.prepare(`
      INSERT INTO matches (id, status, scoreA, scoreB, durationMinutes, startedAt, endedAt, isCurrent)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      match.id,
      match.status,
      match.scoreA,
      match.scoreB,
      match.durationMinutes,
      match.startedAt?.toISOString() ?? null,
      match.endedAt?.toISOString() ?? null
    );

    console.log('[SQLiteMatchStore] Created match:', match.id);
    return match;
  }

  /**
   * Updates an existing match
   */
  async updateMatch(match: Match): Promise<Match> {
    const db = getDatabase();

    db.prepare(`
      UPDATE matches SET
        status = ?,
        scoreA = ?,
        scoreB = ?,
        durationMinutes = ?,
        startedAt = ?,
        endedAt = ?
      WHERE id = ?
    `).run(
      match.status,
      match.scoreA,
      match.scoreB,
      match.durationMinutes,
      match.startedAt?.toISOString() ?? null,
      match.endedAt?.toISOString() ?? null,
      match.id
    );

    console.log('[SQLiteMatchStore] Updated match:', match.id);
    return match;
  }

  /**
   * Gets the current active match
   */
  async getCurrentMatch(): Promise<Match | null> {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM matches WHERE isCurrent = 1').get() as MatchRow | undefined;

    if (!row) return null;

    return this.rowToMatch(row);
  }

  /**
   * Gets a match by its ID
   */
  async getMatchById(id: string): Promise<Match | null> {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM matches WHERE id = ?').get(id) as MatchRow | undefined;

    if (!row) return null;

    return this.rowToMatch(row);
  }

  /**
   * Gets all matches (for history)
   */
  async getAllMatches(): Promise<Match[]> {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM matches ORDER BY startedAt DESC').all() as MatchRow[];

    return rows.map(row => this.rowToMatch(row));
  }

  /**
   * Converts a database row to a Match entity
   */
  private rowToMatch(row: MatchRow): Match {
    return {
      id: row.id,
      status: row.status as Match['status'],
      scoreA: row.scoreA,
      scoreB: row.scoreB,
      durationMinutes: row.durationMinutes,
      startedAt: row.startedAt ? new Date(row.startedAt) : null,
      endedAt: row.endedAt ? new Date(row.endedAt) : null,
    };
  }
}

/**
 * Database row type for matches
 */
interface MatchRow {
  id: string;
  status: string;
  scoreA: number;
  scoreB: number;
  durationMinutes: number;
  startedAt: string | null;
  endedAt: string | null;
  isCurrent: number;
}
