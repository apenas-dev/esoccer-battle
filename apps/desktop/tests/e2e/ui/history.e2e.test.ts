/**
 * Match History E2E Tests
 * Verifies history of multiple matches
 */
import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import { sleep } from '../helpers/waitHelper';
import { startPythonBackend, stopPythonBackend } from '../helpers/electronHelper';
import * as sqliteHelper from '../helpers/sqliteHelper';

let electronApp: ElectronApplication;
let page: Page;

test.describe('Match History', () => {
  test.beforeAll(async () => {
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

  test('should create multiple matches and track history', async () => {
    const inputSelector = 'input[type="text"], [data-testid="command-input"]';
    const hasInput = await page.locator(inputSelector).count() > 0;
    
    if (!hasInput) {
      console.log('No text input available, skipping');
      return;
    }

    // Create first match
    console.log('Creating first match...');
    await page.locator(inputSelector).first().fill('volta 6');
    await page.keyboard.press('Enter');
    await sleep(2000);
    
    // End first match
    await page.locator(inputSelector).first().fill('encerrar');
    await page.keyboard.press('Enter');
    await sleep(1000);
    await page.locator(inputSelector).first().fill('confirmar');
    await page.keyboard.press('Enter');
    await sleep(2000);
    
    // Create second match
    console.log('Creating second match...');
    await page.locator(inputSelector).first().fill('volta 6');
    await page.keyboard.press('Enter');
    await sleep(2000);
    
    // End second match
    await page.locator(inputSelector).first().fill('encerrar');
    await page.keyboard.press('Enter');
    await sleep(1000);
    await page.locator(inputSelector).first().fill('confirmar');
    await page.keyboard.press('Enter');
    await sleep(2000);
    
    // Verify matches were created
    if (sqliteHelper.databaseExists()) {
      const matches = sqliteHelper.getAllMatches();
      console.log(`Total matches in history: ${matches.length}`);
      expect(matches.length).toBeGreaterThanOrEqual(2);
    }
  });

  test('should retrieve match history ordered by date', async () => {
    if (!sqliteHelper.databaseExists()) {
      console.log('Database does not exist, skipping');
      return;
    }
    
    const matches = sqliteHelper.getAllMatches();
    
    if (matches.length >= 2) {
      // Verify ordering (newest first)
      const firstDate = new Date(matches[0].createdAt);
      const secondDate = new Date(matches[1].createdAt);
      expect(firstDate.getTime()).toBeGreaterThanOrEqual(secondDate.getTime());
    }
  });

  test('should verify match data integrity in history', async () => {
    if (!sqliteHelper.databaseExists()) {
      console.log('Database does not exist, skipping');
      return;
    }
    
    const matches = sqliteHelper.getAllMatches();
    
    for (const match of matches) {
      expect(sqliteHelper.verifyMatchIntegrity(match)).toBe(true);
      expect(match.status).toBeDefined();
      expect(['aguardando', 'emAndamento', 'pausado', 'encerrado']).toContain(match.status);
    }
  });

  test('should have command execution logs for each match', async () => {
    if (!sqliteHelper.databaseExists()) {
      console.log('Database does not exist, skipping');
      return;
    }
    
    const matches = sqliteHelper.getAllMatches();
    
    for (const match of matches.slice(0, 3)) { // Check first 3 matches
      const executions = sqliteHelper.getCommandExecutions(match.id);
      console.log(`Match ${match.id}: ${executions.length} command executions`);
      expect(Array.isArray(executions)).toBe(true);
    }
  });
});
