import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

import type { FuelType, LatLng, Station } from './types';

const NEARBY_RADIUS_M = 5000;

// Round the map centre to ~1 km so small pans reuse the cached result instead of refetching.
const round = (n: number) => Math.round(n * 100) / 100;

export function useNearbyStations(center: LatLng | null) {
  const lat = center ? round(center.latitude) : null;
  const lng = center ? round(center.longitude) : null;
  return useQuery({
    queryKey: ['stations', 'nearby', lat, lng],
    enabled: lat != null && lng != null,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('nearby_stations', {
        lat: lat!,
        lng: lng!,
        radius_m: NEARBY_RADIUS_M,
      });
      if (error) throw error;
      return data as Station[];
    },
  });
}

export function useFuelTypes() {
  return useQuery({
    queryKey: ['fuel-types'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fuel_types')
        .select('code, label, short_label, sort')
        .order('sort');
      if (error) throw error;
      return data as FuelType[];
    },
  });
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export function useStationSearch(query: string, near: LatLng | null) {
  const q = useDebounced(query.trim(), 300);
  return useQuery({
    queryKey: [
      'stations',
      'search',
      q,
      near && round(near.latitude),
      near && round(near.longitude),
    ],
    enabled: q.length >= 2 && near != null,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_stations', {
        query: q,
        lat: near!.latitude,
        lng: near!.longitude,
      });
      if (error) throw error;
      return data as Station[];
    },
  });
}
