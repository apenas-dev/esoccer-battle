/**
 * SQLite Database Initialization
 * Follows KISS - simple setup with auto-table creation
 * Uses proper paths for Electron environment
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';

let db: Database.Database | null = null;

/**
 * Gets the appropriate data directory for Electron
 * Works in both development and production environments
 */
function getDataDirectory(): string {
  // In Electron, __dirname points to the built preload script location
  // We go up to find a suitable data directory
  
  // Try environment variable first (for testing)
  if (process.env.ESOCCER_DATA_DIR) {
    return process.env.ESOCCER_DATA_DIR;
  }
  
  // For development: use project root/data
  // For production: use userData path (set by main process)
  if (process.env.ESOCCER_USER_DATA) {
    return join(process.env.ESOCCER_USER_DATA, 'data');
  }
  
  // Fallback: use directory relative to module location
  // In dev: dist-electron/preload -> go up to project root
  // __dirname in preload will be like /path/to/apps/desktop/dist-electron/preload
  const preloadDir = __dirname;
  const projectRoot = join(preloadDir, '..', '..');
  const dataDir = join(projectRoot, 'data');
  
  console.log('[database] Calculated data directory:', dataDir);
  console.log('[database] __dirname:', preloadDir);
  
  return dataDir;
}

/**
 * Gets or creates the database instance
 */
export function getDatabase(): Database.Database {
  if (db) return db;

  try {
    const dataDir = getDataDirectory();
    
    // Ensure data directory exists
    if (!existsSync(dataDir)) {
      console.log('[database] Creating data directory:', dataDir);
      mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = join(dataDir, 'esoccer.db');
    console.log('[database] Opening SQLite database at:', dbPath);

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    initializeTables(db);

    return db;
  } catch (error) {
    console.error('[database] Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Creates tables if they don't exist
 */
function initializeTables(database: Database.Database): void {
  console.log('[database] Initializing tables...');

  try {
    // Matches table
    database.exec(`
      CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'aguardando',
        scoreA INTEGER NOT NULL DEFAULT 0,
        scoreB INTEGER NOT NULL DEFAULT 0,
        durationMinutes INTEGER NOT NULL DEFAULT 6,
        startedAt TEXT,
        endedAt TEXT,
        isCurrent INTEGER NOT NULL DEFAULT 0
      )
    `);

    // Command executions table
    database.exec(`
      CREATE TABLE IF NOT EXISTS commandExecutions (
        id TEXT PRIMARY KEY,
        matchId TEXT NOT NULL,
        commandId TEXT NOT NULL,
        userText TEXT NOT NULL,
        systemText TEXT NOT NULL,
        confirmed INTEGER NOT NULL DEFAULT 1,
        repetitionNumber INTEGER NOT NULL DEFAULT 1,
        latencyMs INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL
      )
    `);

    // Create index for faster queries
    database.exec(`
      CREATE INDEX IF NOT EXISTS idx_commandExecutions_matchId 
      ON commandExecutions(matchId)
    `);

    console.log('[database] Tables initialized successfully');
  } catch (error) {
    console.error('[database] Failed to initialize tables:', error);
    throw error;
  }
}

/**
 * Closes the database connection
 */
export function closeDatabase(): void {
  if (db) {
    try {
      db.close();
      db = null;
      console.log('[database] Database connection closed');
    } catch (error) {
      console.error('[database] Error closing database:', error);
    }
  }
}
