/**
 * In-Memory Command Log Store - Implements CommandLogStorePort
 * 
 * SOLID: Implements interface defined by port
 * KISS: Simple array-based storage
 */

import { CommandExecution } from '../entities/CommandExecution';
import { CommandLogStorePort } from '../ports/CommandLogStorePort';

export class InMemoryCommandLogStore implements CommandLogStorePort {
  private executions: CommandExecution[] = [];

  async logCommandExecution(execution: CommandExecution): Promise<void> {
    this.executions.push({ ...execution });
  }

  async listByMatch(matchId: string): Promise<CommandExecution[]> {
    return this.executions
      .filter((exec) => exec.matchId === matchId)
      .map((exec) => ({ ...exec }));
  }

  /**
   * Utility method for testing - clear all logs
   */
  clear(): void {
    this.executions = [];
  }

  /**
   * Utility method - get all executions count
   */
  count(): number {
    return this.executions.length;
  }
}
