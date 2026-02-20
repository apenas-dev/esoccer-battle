/**
 * SQLite Helper for E2E Tests
 * Provides functions to verify and manipulate SQLite data
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../../data');
const DB_PATH = path.join(DATA_DIR, 'esoccer.db');

/**
 * Get database instance
 */
export function getDatabase(): Database.Database {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`Database not found at: ${DB_PATH}`);
  }
  return new Database(DB_PATH);
}

/**
 * Check if database exists
 */
export function databaseExists(): boolean {
  return fs.existsSync(DB_PATH);
}

/**
 * Get all matches from database
 */
export function getAllMatches(): any[] {
  const db = getDatabase();
  try {
    const stmt = db.prepare('SELECT * FROM matches ORDER BY createdAt DESC');
    return stmt.all();
  } finally {
    db.close();
  }
}

/**
 * Get match by ID
 */
export function getMatchById(id: string): any | null {
  const db = getDatabase();
  try {
    const stmt = db.prepare('SELECT * FROM matches WHERE id = ?');
    return stmt.get(id) || null;
  } finally {
    db.close();
  }
}

/**
 * Get current active match
 */
export function getCurrentMatch(): any | null {
  const db = getDatabase();
  try {
    const stmt = db.prepare('SELECT * FROM matches WHERE isCurrent = 1 LIMIT 1');
    return stmt.get() || null;
  } finally {
    db.close();
  }
}

/**
 * Get match count
 */
export function getMatchCount(): number {
  const db = getDatabase();
  try {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM matches');
    const result = stmt.get() as { count: number };
    return result.count;
  } finally {
    db.close();
  }
}

/**
 * Get command executions for a match
 */
export function getCommandExecutions(matchId: string): any[] {
  const db = getDatabase();
  try {
    const stmt = db.prepare('SELECT * FROM commandExecutions WHERE matchId = ? ORDER BY executedAt DESC');
    return stmt.all(matchId);
  } finally {
    db.close();
  }
}

/**
 * Clear all test data from database
 */
export function clearTestData(): void {
  const db = getDatabase();
  try {
    db.exec('DELETE FROM commandExecutions');
    db.exec('DELETE FROM matches');
    console.log('Test data cleared from database');
  } finally {
    db.close();
  }
}

/**
 * Delete database file (for fresh start)
 */
export function deleteDatabase(): void {
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log('Database file deleted');
  }
}

/**
 * Ensure data directory exists
 */
export function ensureDataDirectory(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('Data directory created');
  }
}

/**
 * Verify match data integrity
 */
export function verifyMatchIntegrity(match: any): boolean {
  const requiredFields = ['id', 'homeTeam', 'awayTeam', 'homeScore', 'awayScore', 'status', 'createdAt'];
  return requiredFields.every(field => match.hasOwnProperty(field));
}
