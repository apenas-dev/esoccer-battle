/**
 * Command Engine - Main orchestrator for voice command processing
 * 
 * SOLID Principles:
 * - Single Responsibility: Orchestrates command processing only
 * - Open/Closed: New commands added via handlers, not engine modification
 * - Dependency Inversion: Depends on ports, not concrete implementations
 * 
 * KISS: Simple flow - parse → route → execute → respond
 */

import { parseCommand, CommandId, ParsedCommand } from './commandParser';
import { MatchStorePort } from '../ports/MatchStorePort';
import { DoubtStorePort } from '../ports/DoubtStorePort';
import { CommandLogStorePort } from '../ports/CommandLogStorePort';
import { createCommandExecution } from '../entities/CommandExecution';

import {
  handleVolta6,
  handleResultado,
  handleIntervalo,
  handleDuvidaAgora,
  handleEncerrar,
  handleComandosVoz,
  handleAdicionarPontoTimeA,
  handleAdicionarPontoTimeB,
} from './commandHandlers';

export interface CommandResult {
  success: boolean;
  commandId: CommandId;
  message: string;
  data?: unknown;
}

export interface CommandEngineDependencies {
  matchStore: MatchStorePort;
  doubtStore: DoubtStorePort;
  commandLogStore: CommandLogStorePort;
}

/**
 * Command Engine class - processes voice commands
 */
export class CommandEngine {
  private matchStore: MatchStorePort;
  private doubtStore: DoubtStorePort;
  private commandLogStore: CommandLogStorePort;
  private pendingConfirmation: CommandId | null = null;

  constructor(dependencies: CommandEngineDependencies) {
    this.matchStore = dependencies.matchStore;
    this.doubtStore = dependencies.doubtStore;
    this.commandLogStore = dependencies.commandLogStore;
  }

  /**
   * Process a voice command from transcribed text
   */
  async processCommand(transcribedText: string): Promise<CommandResult> {
    const startTime = Date.now();
    const parsed = parseCommand(transcribedText);

    let result: CommandResult;

    // Check if we're waiting for confirmation
    if (this.pendingConfirmation === 'encerrar' && parsed.commandId === 'encerrar') {
      result = await this.executeCommand('encerrar', parsed, true);
      this.pendingConfirmation = null;
    } else {
      result = await this.executeCommand(parsed.commandId, parsed, false);
    }

    // Track pending confirmation
    if (result.data && typeof result.data === 'object' && 'requiresConfirmation' in result.data) {
      if ((result.data as { requiresConfirmation: boolean }).requiresConfirmation) {
        this.pendingConfirmation = parsed.commandId;
      }
    }

    // Log command execution
    const latencyMs = Date.now() - startTime;
    await this.logExecution(parsed, result, latencyMs);

    return result;
  }

  /**
   * Execute the appropriate handler for a command
   */
  private async executeCommand(
    commandId: CommandId,
    parsed: ParsedCommand,
    confirmed: boolean
  ): Promise<CommandResult> {
    switch (commandId) {
      case 'volta6': {
        const result = await handleVolta6(this.matchStore);
        return {
          success: result.success,
          commandId,
          message: result.message,
          data: result,
        };
      }

      case 'resultado': {
        const result = await handleResultado(this.matchStore);
        return {
          success: result.success,
          commandId,
          message: result.message,
          data: result,
        };
      }

      case 'intervalo': {
        const result = await handleIntervalo(this.matchStore);
        return {
          success: result.success,
          commandId,
          message: result.message,
          data: result,
        };
      }

      case 'duvidaAgora': {
        const result = await handleDuvidaAgora(this.matchStore, this.doubtStore);
        return {
          success: result.success,
          commandId,
          message: result.message,
          data: result,
        };
      }

      case 'encerrar': {
        const result = await handleEncerrar(this.matchStore, confirmed);
        return {
          success: result.success,
          commandId,
          message: result.message,
          data: result,
        };
      }

      case 'comandosVoz': {
        const result = await handleComandosVoz();
        return {
          success: result.success,
          commandId,
          message: result.message,
          data: result,
        };
      }

      case 'adicionarPontoTimeA': {
        const result = await handleAdicionarPontoTimeA(this.matchStore);
        return {
          success: true, // We assume success or handle it inside
          commandId,
          message: result.message,
          data: result,
        };
      }

      case 'adicionarPontoTimeB': {
        const result = await handleAdicionarPontoTimeB(this.matchStore);
        return {
          success: true,
          commandId,
          message: result.message,
          data: result,
        };
      }

      default:
        return {
          success: false,
          commandId: 'unknown',
          message: `Comando não reconhecido: "${parsed.rawText}". Diga "comandos de voz" para ajuda.`,
        };
    }
  }

  /**
   * Log command execution for auditing
   */
  private async logExecution(
    parsed: ParsedCommand,
    result: CommandResult,
    latencyMs: number
  ): Promise<void> {
    const match = await this.matchStore.getCurrentMatch();
    if (!match) return;

    const execution = createCommandExecution(
      crypto.randomUUID(),
      match.id,
      parsed.commandId,
      parsed.rawText,
      result.message,
      latencyMs,
      result.success
    );

    await this.commandLogStore.logCommandExecution(execution);
  }

  /**
   * Reset confirmation state
   */
  resetConfirmation(): void {
    this.pendingConfirmation = null;
  }
}
