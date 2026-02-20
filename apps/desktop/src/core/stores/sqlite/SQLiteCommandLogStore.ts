/**
 * SQLite Command Log Store
 * Implements CommandLogStorePort using better-sqlite3
 * Follows SOLID (SRP, DIP) + KISS + camelCase
 */

import { CommandLogStorePort } from '../../ports/CommandLogStorePort';
import { CommandExecution } from '../../entities/CommandExecution';
import { getDatabase } from './database';

export class SQLiteCommandLogStore implements CommandLogStorePort {
  /**
   * Logs a command execution to the database
   */
  async logCommandExecution(execution: CommandExecution): Promise<void> {
    const db = getDatabase();

    db.prepare(`
      INSERT INTO commandExecutions 
      (id, matchId, commandId, userText, systemText, confirmed, repetitionNumber, latencyMs, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      execution.id,
      execution.matchId,
      execution.commandId,
      execution.userText,
      execution.systemText,
      execution.confirmed ? 1 : 0,
      execution.repetitionNumber,
      execution.latencyMs,
      execution.createdAt.toISOString()
    );

    console.log('[SQLiteCommandLogStore] Logged command:', execution.commandId);
  }

  /**
   * Lists all command executions for a given match
   */
  async listByMatch(matchId: string): Promise<CommandExecution[]> {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM commandExecutions 
      WHERE matchId = ? 
      ORDER BY createdAt ASC
    `).all(matchId) as CommandExecutionRow[];

    return rows.map(row => this.rowToCommandExecution(row));
  }

  /**
   * Gets all command executions (for debugging/analysis)
   */
  async getAll(): Promise<CommandExecution[]> {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM commandExecutions ORDER BY createdAt DESC').all() as CommandExecutionRow[];

    return rows.map(row => this.rowToCommandExecution(row));
  }

  /**
   * Converts a database row to a CommandExecution entity
   */
  private rowToCommandExecution(row: CommandExecutionRow): CommandExecution {
    return {
      id: row.id,
      matchId: row.matchId,
      commandId: row.commandId,
      userText: row.userText,
      systemText: row.systemText,
      confirmed: row.confirmed === 1,
      repetitionNumber: row.repetitionNumber,
      latencyMs: row.latencyMs,
      createdAt: new Date(row.createdAt),
    };
  }
}

/**
 * Database row type for command executions
 */
interface CommandExecutionRow {
  id: string;
  matchId: string;
  commandId: string;
  userText: string;
  systemText: string;
  confirmed: number;
  repetitionNumber: number;
  latencyMs: number;
  createdAt: string;
}
