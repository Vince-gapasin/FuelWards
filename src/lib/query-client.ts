import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';

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

// Phones report connectivity through NetInfo; browsers already use navigator.onLine.
if (Platform.OS !== 'web') {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
  );
}

/** Saved data is shown offline for up to a day. */
export const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Keep results around as long as they may be restored from the device cache.
        gcTime: CACHE_MAX_AGE,
        retry: (failureCount, error) =>
          isJwtExpired(error) ? failureCount < 2 && refreshThenRetry() : failureCount < 2,
        // Give the refresh a moment to finish before retrying.
        retryDelay: (attempt, error) =>
          isJwtExpired(error) ? 800 : Math.min(1000 * 2 ** attempt, 8000),
      },
      mutations: {
        // Fail straight away when offline instead of waiting silently for a connection.
        networkMode: 'always',
        // Reports and votes aren't retried in general, but a rejected token means nothing ran.
        retry: (failureCount, error) =>
          isJwtExpired(error) && failureCount < 1 && refreshThenRetry(),
        retryDelay: 800,
      },
    },
  });
}

/** Stores successful query results on the device (AsyncStorage; localStorage on web). */
export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'fw.queryCache',
  throttleTime: 2000,
});
