/**
 * CommandExecution entity representing a voice command execution log
 * Tracks command history for auditing and analysis
 */

export interface CommandExecution {
  id: string;
  matchId: string;
  commandId: string;
  userText: string;
  systemText: string;
  confirmed: boolean;
  repetitionNumber: number;
  latencyMs: number;
  createdAt: Date;
}

/**
 * Factory function to create a new command execution record
 */
export function createCommandExecution(
  id: string,
  matchId: string,
  commandId: string,
  userText: string,
  systemText: string,
  latencyMs: number,
  confirmed: boolean = true,
  repetitionNumber: number = 1
): CommandExecution {
  return {
    id,
    matchId,
    commandId,
    userText,
    systemText,
    confirmed,
    repetitionNumber,
    latencyMs,
    createdAt: new Date(),
  };
}
