import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { LatLng } from '@/features/stations/types';
import { supabase } from '@/lib/supabase';

export type PendingReport = {
  id: string;
  fuel_type: string;
  price: number;
  reported_at: string;
  flagged: boolean;
  confirms: number;
  disputes: number;
  needed: number;
  is_mine: boolean;
  my_vote: 'confirm' | 'dispute' | null;
};

export type StationDetails = {
  id: string;
  name: string;
  address: string | null;
  brand: string | null;
  prices: Record<string, { price: number; reported_at: string }>;
};

export type SubmitResult = {
  report_ids: string[];
  pending_points: number;
  flagged: boolean;
  distance_m: number;
};

export type VoteResult = {
  status: 'pending' | 'verified' | 'rejected';
  confirms: number;
  disputes: number;
  needed: number;
};

export function useStationDetails(stationId: string) {
  return useQuery({
    queryKey: ['station', stationId],
    queryFn: async (): Promise<StationDetails> => {
      const [station, prices] = await Promise.all([
        supabase
          .from('stations')
          .select('id, name, address, brands(name)')
          .eq('id', stationId)
          .single(),
        supabase
          .from('station_latest_prices')
          .select('fuel_type, price, reported_at')
          .eq('station_id', stationId),
      ]);
      if (station.error) throw station.error;
      if (prices.error) throw prices.error;
      const brand = station.data.brands as { name: string } | { name: string }[] | null;
      return {
        id: station.data.id,
        name: station.data.name,
        address: station.data.address,
        brand: Array.isArray(brand) ? (brand[0]?.name ?? null) : (brand?.name ?? null),
        prices: Object.fromEntries(
          prices.data.map((p) => [
            p.fuel_type,
            { price: Number(p.price), reported_at: p.reported_at },
          ]),
        ),
      };
    },
  });
}

export function usePendingReports(stationId: string) {
  return useQuery({
    queryKey: ['pending-reports', stationId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('station_pending_reports', {
        p_station_id: stationId,
      });
      if (error) throw error;
      return (data as PendingReport[]).map((r) => ({ ...r, price: Number(r.price) }));
    },
  });
}

/** After a report or vote: station prices, pending lists and the user's points may all change. */
function useRefreshAfterChange() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['stations'] }),
      queryClient.invalidateQueries({ queryKey: ['station'] }),
      queryClient.invalidateQueries({ queryKey: ['pending-reports'] }),
      queryClient.invalidateQueries({ queryKey: ['profile'] }),
    ]);
}

export function useSubmitReport(stationId: string) {
  const refresh = useRefreshAfterChange();
  return useMutation({
    mutationFn: async ({ prices, at }: { prices: Record<string, number>; at: LatLng }) => {
      const { data, error } = await supabase.rpc('submit_price_report', {
        p_station_id: stationId,
        p_prices: prices,
        p_lat: at.latitude,
        p_lng: at.longitude,
      });
      if (error) throw error;
      return data as SubmitResult;
    },
    onSuccess: refresh,
  });
}

export function useVote() {
  const refresh = useRefreshAfterChange();
  return useMutation({
    mutationFn: async ({
      reportId,
      vote,
      at,
    }: {
      reportId: string;
      vote: 'confirm' | 'dispute';
      at: LatLng;
    }) => {
      const { data, error } = await supabase.rpc('vote_on_report', {
        p_report_id: reportId,
        p_vote: vote,
        p_lat: at.latitude,
        p_lng: at.longitude,
      });
      if (error) throw error;
      return data as VoteResult;
    },
    onSuccess: refresh,
  });
}
