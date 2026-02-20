/**
 * Command Log Store Port (DIP - Dependency Inversion)
 * Repository interface for CommandExecution persistence
 */

import { CommandExecution } from '../entities/CommandExecution';

export interface CommandLogStorePort {
  logCommandExecution(execution: CommandExecution): Promise<void>;
  listByMatch(matchId: string): Promise<CommandExecution[]>;
}
