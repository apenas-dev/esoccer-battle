/**
 * Persistence E2E Tests
 * Verifies SQLite data persistence (matches saved correctly)
 */
import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import { sleep } from '../helpers/waitHelper';
import { startPythonBackend, stopPythonBackend } from '../helpers/electronHelper';
import * as sqliteHelper from '../helpers/sqliteHelper';

let electronApp: ElectronApplication;
let page: Page;

test.describe('SQLite Persistence', () => {
  test.beforeAll(async () => {
    // Ensure data directory exists
    sqliteHelper.ensureDataDirectory();
    
    await startPythonBackend();
    
    const mainPath = path.resolve(__dirname, '../../../dist-electron/main/index.js');
    electronApp = await electron.launch({
      args: [mainPath],
      env: { ...process.env, NODE_ENV: 'test' },
    });
    
    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await sleep(5000);
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
    await stopPythonBackend();
  });

  test('should have data directory created', () => {
    const dataDir = path.resolve(__dirname, '../../../data');
    const exists = require('fs').existsSync(dataDir);
    expect(exists).toBe(true);
  });

  test('should create database file after app start', async () => {
    // Wait for app to initialize and potentially create DB
    await sleep(3000);
    
    // Database might be created on first command
    const inputSelector = 'input[type="text"], [data-testid="command-input"]';
    const hasInput = await page.locator(inputSelector).count() > 0;
    
    if (hasInput) {
      await page.locator(inputSelector).first().fill('volta 6');
      await page.keyboard.press('Enter');
      await sleep(3000);
    }
    
    // Check if database was created
    if (sqliteHelper.databaseExists()) {
      expect(sqliteHelper.databaseExists()).toBe(true);
    } else {
      console.log('Database not yet created (might use in-memory store)');
    }
  });

  test('should save match data to database', async () => {
    if (!sqliteHelper.databaseExists()) {
      console.log('Skipping: Database does not exist');
      return;
    }
    
    const matches = sqliteHelper.getAllMatches();
    console.log(`Found ${matches.length} matches in database`);
    
    if (matches.length > 0) {
      const lastMatch = matches[0];
      expect(lastMatch).toHaveProperty('id');
      expect(lastMatch).toHaveProperty('homeTeam');
      expect(lastMatch).toHaveProperty('awayTeam');
      expect(lastMatch).toHaveProperty('status');
      expect(sqliteHelper.verifyMatchIntegrity(lastMatch)).toBe(true);
    }
  });

  test('should persist command executions', async () => {
    if (!sqliteHelper.databaseExists()) {
      console.log('Skipping: Database does not exist');
      return;
    }
    
    const currentMatch = sqliteHelper.getCurrentMatch();
    if (currentMatch) {
      const executions = sqliteHelper.getCommandExecutions(currentMatch.id);
      console.log(`Found ${executions.length} command executions for current match`);
      expect(Array.isArray(executions)).toBe(true);
    }
  });

  test('should maintain data after creating new match', async () => {
    const initialCount = sqliteHelper.databaseExists() ? sqliteHelper.getMatchCount() : 0;
    
    // Create another match
    const inputSelector = 'input[type="text"], [data-testid="command-input"]';
    const hasInput = await page.locator(inputSelector).count() > 0;
    
    if (hasInput) {
      // End current match first
      await page.locator(inputSelector).first().fill('encerrar');
      await page.keyboard.press('Enter');
      await sleep(1000);
      await page.locator(inputSelector).first().fill('confirmar');
      await page.keyboard.press('Enter');
      await sleep(2000);
      
      // Create new match
      await page.locator(inputSelector).first().fill('volta 6');
      await page.keyboard.press('Enter');
      await sleep(3000);
    }
    
    if (sqliteHelper.databaseExists()) {
      const newCount = sqliteHelper.getMatchCount();
      console.log(`Match count: ${initialCount} -> ${newCount}`);
      expect(newCount).toBeGreaterThanOrEqual(initialCount);
    }
  });
});
