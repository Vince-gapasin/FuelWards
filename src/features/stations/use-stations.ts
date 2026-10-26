import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useAuthStore } from '@/features/auth/auth-store';
import { supabase } from '@/lib/supabase';

import type { PricePoint } from './chart';
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

export function useDebounced<T>(value: T, ms: number): T {
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

/** Daily confirmed prices for the last 30 days, grouped by fuel code. */
export function usePriceHistory(stationId: string) {
  return useQuery({
    queryKey: ['price-history', stationId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('station_price_history', {
        p_station_id: stationId,
        p_days: 30,
      });
      if (error) throw error;
      const byFuel: Record<string, PricePoint[]> = {};
      for (const row of data as { fuel_type: string; day: string; price: number }[]) {
        (byFuel[row.fuel_type] ??= []).push({ day: row.day, price: Number(row.price) });
      }
      return byFuel;
    },
  });
}

/** IDs of the stations the user saved. */
export function useFavoriteIds() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery({
    queryKey: ['favorites', 'ids', userId],
    enabled: Boolean(userId),
    // The cache keeps a plain array: it is saved as JSON for offline use, and a Set would come
    // back as {}. Screens get a Set through `select`.
    queryFn: async () => {
      const { data, error } = await supabase.from('favorites').select('station_id');
      if (error) throw error;
      return data.map((f) => f.station_id);
    },
    select: (ids) => new Set(Array.isArray(ids) ? ids : []),
  });
}

export function useFavoriteStations(near: LatLng | null) {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery({
    queryKey: [
      'favorites',
      'stations',
      userId,
      near && round(near.latitude),
      near && round(near.longitude),
    ],
    enabled: Boolean(userId && near),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('favorite_stations', {
        lat: near!.latitude,
        lng: near!.longitude,
      });
      if (error) throw error;
      return data as Station[];
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ stationId, save }: { stationId: string; save: boolean }) => {
      const { error } = save
        ? await supabase.from('favorites').insert({ station_id: stationId })
        : await supabase.from('favorites').delete().eq('station_id', stationId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  });
}
