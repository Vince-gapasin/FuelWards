import { QueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

/**
 * PostgREST rejects a token the server considers expired. If the device clock runs behind,
 * supabase-js still thinks the token is valid and won't refresh it on its own.
 */
export function isJwtExpired(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return e?.code === 'PGRST303' || /jwt expired/i.test(e?.message ?? '');
}

let refreshing: Promise<unknown> | null = null;

/** Refresh the session once (shared by all failing requests), then let the request retry. */
function refreshThenRetry(): true {
  refreshing ??= supabase.auth.refreshSession().finally(() => {
    refreshing = null;
  });
  return true;
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) =>
          isJwtExpired(error) ? failureCount < 2 && refreshThenRetry() : failureCount < 2,
        // Give the refresh a moment to finish before retrying.
        retryDelay: (attempt, error) =>
          isJwtExpired(error) ? 800 : Math.min(1000 * 2 ** attempt, 8000),
      },
      mutations: {
        // Reports and votes aren't retried in general, but a rejected token means nothing ran.
        retry: (failureCount, error) =>
          isJwtExpired(error) && failureCount < 1 && refreshThenRetry(),
        retryDelay: 800,
      },
    },
  });
}
