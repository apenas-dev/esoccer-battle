/**
 * API Helper - E-Soccer Battle
 * Provides safe access to window.esoccerApi
 * Follows KISS + camelCase
 */

import type { EsoccerApi } from '../../preload/index';

/**
 * Checks if the esoccerApi is available
 */
export function isApiAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.esoccerApi !== 'undefined';
}

/**
 * Gets the esoccerApi or throws a helpful error
 */
export function getApi(): EsoccerApi {
  if (!isApiAvailable()) {
    throw new Error(
      'E-Soccer API não disponível. ' +
      'Verifique se a aplicação está rodando no Electron.'
    );
  }
  return window.esoccerApi as EsoccerApi;
}

/**
 * Error message when API is not available
 */
export const API_NOT_AVAILABLE_MESSAGE =
  'API não disponível. A aplicação deve ser executada no Electron.';
