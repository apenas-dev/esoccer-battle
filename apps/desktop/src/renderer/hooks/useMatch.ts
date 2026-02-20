/**
 * useMatch Hook
 * Manages match state from SQLite store
 * Follows KISS + camelCase
 */

import { useState, useEffect, useCallback } from 'react';
import { isApiAvailable, API_NOT_AVAILABLE_MESSAGE } from './apiHelper';

interface Match {
  id: string;
  status: 'aguardando' | 'emAndamento' | 'pausado' | 'encerrado';
  scoreA: number;
  scoreB: number;
  durationMinutes: number;
  startedAt: Date | null;
  endedAt: Date | null;
}

interface UseMatchResult {
  match: Match | null;
  matchHistory: Match[];
  isLoading: boolean;
  error: string | null;
  refreshMatch: () => Promise<void>;
  refreshHistory: () => Promise<void>;
}

export function useMatch(): UseMatchResult {
  const [match, setMatch] = useState<Match | null>(null);
  const [matchHistory, setMatchHistory] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshMatch = useCallback(async () => {
    // Check if API is available
    if (!isApiAvailable()) {
      console.warn('[useMatch] API not available');
      setError(API_NOT_AVAILABLE_MESSAGE);
      setIsLoading(false);
      return;
    }

    try {
      const currentMatch = await window.esoccerApi!.getCurrentMatch();
      setMatch(currentMatch);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar partida';
      setError(message);
      console.error('[useMatch] Error refreshing match:', err);
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    // Check if API is available
    if (!isApiAvailable()) {
      console.warn('[useMatch] API not available for history');
      return;
    }

    try {
      const history = await window.esoccerApi!.getMatchHistory();
      setMatchHistory(history);
    } catch (err) {
      console.error('[useMatch] Error refreshing history:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await refreshMatch();
      await refreshHistory();
      setIsLoading(false);
    };
    load();
  }, [refreshMatch, refreshHistory]);

  // Poll for match updates every 2 seconds (only if API is available)
  useEffect(() => {
    if (!isApiAvailable()) {
      return;
    }
    
    const interval = setInterval(refreshMatch, 2000);
    return () => clearInterval(interval);
  }, [refreshMatch]);

  return {
    match,
    matchHistory,
    isLoading,
    error,
    refreshMatch,
    refreshHistory,
  };
}
