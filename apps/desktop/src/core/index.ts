/**
 * Core Domain Module - E-Soccer Battle
 * 
 * Architecture following SOLID, KISS, DIP principles:
 * - entities/: Domain entities (Match, CommandExecution, Doubt)
 * - ports/: Interfaces for external dependencies (DIP)
 * - commands/: Command engine and handlers
 * - stores/: In-memory implementations of ports
 */

// Entities
export * from './entities';

// Ports (Interfaces)
export * from './ports';

// Commands
export * from './commands';

// Stores (Implementations)
export * from './stores';

// Adapters (External integrations)
export * from './adapters';
