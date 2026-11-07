import { useQuery } from '@tanstack/react-query';

import type { LatLng } from '@/features/stations/types';
import { supabase } from '@/lib/supabase';

import { roundCenter, type DoePrice } from './prices';

// The DOE posts once a week, so these change rarely.
const STALE = 60 * 60_000;

/** The DOE's latest weekly prices for a station's region (empty outside covered regions). */
export function useDoePricesForStation(stationId: string | undefined) {
  return useQuery({
    queryKey: ['doe-prices', 'station', stationId],
    enabled: !!stationId,
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('doe_prices_for_station', {
        p_station_id: stationId!,
      });
      if (error) throw error;
      return data as DoePrice[];
    },
  });
}

/** The DOE's latest weekly prices for the region around a point (the map centre). */
export function useDoePricesNear(center: LatLng) {
  const { lat, lng } = roundCenter(center.latitude, center.longitude);
  return useQuery({
    queryKey: ['doe-prices', 'near', lat, lng],
    staleTime: STALE,
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('doe_prices_near', { p_lat: lat, p_lng: lng });
      if (error) throw error;
      return data as DoePrice[];
    },
  });
}
