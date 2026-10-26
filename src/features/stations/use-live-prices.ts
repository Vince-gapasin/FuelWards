import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { create } from 'zustand';

import type { StationDetails } from '@/features/reports/api';
import { supabase } from '@/lib/supabase';

import { applyLivePrice, applyLivePriceToStation, type LivePrice } from './live';
import type { Station } from './types';

/** How long a pin stays highlighted after its price changes live. */
const HIGHLIGHT_MS = 10_000;

type LiveState = {
  connected: boolean;
  /** Station id → time its price last changed live. */
  recent: Record<string, number>;
};

export const useLiveState = create<LiveState>(() => ({ connected: false, recent: {} }));

/** Whether a station's price changed live in the last few seconds (for the pin highlight). */
export function useRecentlyUpdated(stationId: string): boolean {
  // Entries are removed HIGHLIGHT_MS after they're added, so presence means "recent".
  return useLiveState((s) => s.recent[stationId] != null);
}

/**
 * Listens for prices verified anywhere and patches every cached station list and detail, so the
 * map updates without a reload. Mount once, inside the signed-in screens.
 */
export function useLivePrices() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      // Private: the database is the only sender; signed-in users can only listen.
      .channel('prices', { config: { private: true } })
      .on('broadcast', { event: 'price_verified' }, ({ payload }) => {
        const live = payload as LivePrice;
        for (const key of [['stations'], ['favorites', 'stations']]) {
          queryClient.setQueriesData<Station[]>({ queryKey: key }, (old) =>
            applyLivePrice(old, live),
          );
        }
        queryClient.setQueryData<StationDetails>(['station', live.station_id], (old) =>
          old ? applyLivePriceToStation(old, live) : old,
        );
        queryClient.invalidateQueries({ queryKey: ['price-history', live.station_id] });
        queryClient.invalidateQueries({ queryKey: ['pending-reports', live.station_id] });

        const now = Date.now();
        useLiveState.setState((s) => ({ recent: { ...s.recent, [live.station_id]: now } }));
        // Clear the highlight afterwards so the pin re-renders without it.
        setTimeout(() => {
          useLiveState.setState((s) => {
            if (s.recent[live.station_id] !== now) return s;
            const { [live.station_id]: _, ...rest } = s.recent;
            return { recent: rest };
          });
        }, HIGHLIGHT_MS);
      })
      .subscribe((status) => useLiveState.setState({ connected: status === 'SUBSCRIBED' }));

    return () => {
      useLiveState.setState({ connected: false });
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
