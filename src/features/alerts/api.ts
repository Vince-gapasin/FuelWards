import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/auth-store';
import { supabase } from '@/lib/supabase';
import i18n from '@/i18n';

export type PriceAlert = {
  id: string;
  fuel_type: string;
  max_price: number;
  radius_m: number;
  latitude: number | null;
  longitude: number | null;
  station_id: string | null;
  station_name: string | null;
  is_active: boolean;
  created_at: string;
};

export type AlertMatch = {
  id: number;
  fuel_type: string;
  price: number;
  created_at: string;
  read_at: string | null;
  station_id: string;
  station: { name: string; address: string | null } | null;
};

export type NewAlert = {
  fuelType: string;
  maxPrice: number;
  radiusM: number;
  /** Either an area around a point… */
  at?: { latitude: number; longitude: number };
  /** …or one station. */
  stationId?: string;
};

function useUserId() {
  return useAuthStore((s) => s.session?.user.id);
}

export function useMyAlerts() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['alerts', 'mine', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_price_alerts');
      if (error) throw error;
      return (data as PriceAlert[]).map((a) => ({ ...a, max_price: Number(a.max_price) }));
    },
  });
}

export function useAlertInbox() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['alerts', 'inbox', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alert_deliveries')
        .select(
          'id, fuel_type, price, created_at, read_at, station_id, station:stations(name, address)',
        )
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as unknown as AlertMatch[]).map((m) => ({ ...m, price: Number(m.price) }));
    },
  });
}

export function useUnreadAlertCount() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['alerts', 'unread', userId],
    enabled: Boolean(userId),
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('alert_deliveries')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

function useInvalidateAlerts() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['alerts'] });
}

export function useCreateAlert() {
  const invalidate = useInvalidateAlerts();
  return useMutation({
    mutationFn: async (alert: NewAlert) => {
      const { error } = await supabase.rpc('create_price_alert', {
        p_fuel_type: alert.fuelType,
        p_max_price: alert.maxPrice,
        p_lat: alert.at?.latitude ?? null,
        p_lng: alert.at?.longitude ?? null,
        p_radius_m: alert.radiusM,
        p_station_id: alert.stationId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useSetAlertActive() {
  const invalidate = useInvalidateAlerts();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('price_alerts')
        .update({ is_active: active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteAlert() {
  const invalidate = useInvalidateAlerts();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('price_alerts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useMarkAlertsRead() {
  const invalidate = useInvalidateAlerts();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('alert_deliveries')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function alertErrorMessage(error: unknown): string {
  const e = (error ?? {}) as { message?: string; code?: string };
  if (e.message === 'too_many_alerts') return i18n.t('alerts.errors.tooMany');
  if (e.code === '23514') return i18n.t('alerts.errors.needArea');
  if (e.code === '23503') return i18n.t('alerts.errors.unavailable');
  return i18n.t('alerts.errors.generic');
}
