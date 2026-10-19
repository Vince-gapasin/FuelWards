import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/auth-store';
import { useDebounced } from '@/features/stations/use-stations';
import { supabase } from '@/lib/supabase';

// Admin console data. Every call is checked again on the server (is_admin), so hiding the
// console from other users is only a convenience.

export type Overview = {
  flagged: number;
  pending: number;
  reports_today: number;
  users: number;
  new_users_week: number;
  banned: number;
  redemptions_week: number;
  stations: number;
  hidden_stations: number;
};

export type QueueFilter = 'flagged' | 'pending' | 'decided';

export type QueuedReport = {
  id: string;
  station_id: string;
  station_name: string;
  fuel_type: string;
  price: number;
  reported_at: string;
  status: 'pending' | 'verified' | 'rejected';
  flagged: boolean;
  flag_reason: string | null;
  distance_m: number | null;
  confirms: number;
  disputes: number;
  reporter_id: string | null;
  reporter_username: string | null;
  reporter_verified: number;
  reporter_rejected: number;
  reporter_banned: boolean;
};

export type AdminUser = {
  id: string;
  username: string;
  display_name: string | null;
  role: 'user' | 'admin';
  created_at: string;
  banned_at: string | null;
  ban_reason: string | null;
  balance: number;
  verified_reports: number;
  rejected_reports: number;
  pending_reports: number;
};

export type AdminStation = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  is_active: boolean;
  brands: { name: string } | null;
};

export type AdminReward = {
  id: string;
  title: string;
  description: string | null;
  partner: string | null;
  cost_points: number;
  stock: number | null;
  is_active: boolean;
};

export type Bulletin = {
  id: string;
  effective_date: string;
  fuel_type: string;
  region: string;
  change_min: number;
  change_max: number;
  source_url: string | null;
};

export type AuditEntry = {
  id: number;
  admin_username: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
};

async function unwrap<T>(request: PromiseLike<{ data: unknown; error: unknown }>): Promise<T> {
  const { data, error } = await request;
  if (error) throw error;
  return data as T;
}

/** Whether the signed-in user is an admin. Used to show the console link and guard its screens. */
export function useIsAdmin() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery({
    queryKey: ['admin', 'is-admin', userId],
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
    queryFn: () => unwrap<boolean>(supabase.rpc('is_admin')),
  });
}

export function useOverview() {
  return useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => unwrap<Overview>(supabase.rpc('admin_overview')),
  });
}

export function useReportQueue(filter: QueueFilter) {
  return useQuery({
    queryKey: ['admin', 'reports', filter],
    queryFn: () => unwrap<QueuedReport[]>(supabase.rpc('admin_report_queue', { p_filter: filter })),
  });
}

export function useDecideReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, outcome }: { id: string; outcome: 'verified' | 'rejected' }) =>
      unwrap<void>(supabase.rpc('admin_decide_report', { p_report_id: id, p_outcome: outcome })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });
}

export function useAdminUsers(search: string) {
  const term = useDebounced(search.trim(), 300);
  return useQuery({
    queryKey: ['admin', 'users', term],
    queryFn: () => unwrap<AdminUser[]>(supabase.rpc('admin_users', { p_search: term })),
    placeholderData: (previous) => previous,
  });
}

export function useSetBan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, banned, reason }: { id: string; banned: boolean; reason?: string }) =>
      unwrap<void>(
        supabase.rpc('admin_set_ban', {
          p_user_id: id,
          p_banned: banned,
          p_reason: reason ?? null,
        }),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });
}

/** Every word must match the name, address, city or brand: "petron edsa" finds Petron stations on EDSA. */
export function useAdminStations(search: string) {
  const term = useDebounced(search.trim(), 300);
  return useQuery({
    queryKey: ['admin', 'stations', term],
    placeholderData: (previous) => previous,
    queryFn: async () => {
      let query = supabase
        .from('stations')
        .select('id, name, address, city, is_active, brands(name)')
        .order('is_active')
        .order('name')
        .limit(50);
      // Characters that would break PostgREST's filter syntax.
      const words = term
        .replace(/[%,().":*\\]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);
      if (words.length) {
        const brands = await unwrap<{ id: number; name: string }[]>(
          supabase.from('brands').select('id, name'),
        );
        for (const word of words) {
          const brandIds = brands
            .filter((b) => b.name.toLowerCase().includes(word.toLowerCase()))
            .map((b) => b.id);
          const brandMatch = brandIds.length ? `,brand_id.in.(${brandIds.join(',')})` : '';
          query = query.or(
            `name.ilike.%${word}%,address.ilike.%${word}%,city.ilike.%${word}%${brandMatch}`,
          );
        }
      }
      return unwrap<AdminStation[]>(query);
    },
  });
}

export function useUpdateStation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...changes }: Partial<AdminStation> & { id: string }) =>
      unwrap<void>(supabase.from('stations').update(changes).eq('id', id)),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      queryClient.invalidateQueries({ queryKey: ['stations'] });
    },
  });
}

export function useAdminRewards() {
  return useQuery({
    queryKey: ['admin', 'rewards'],
    queryFn: () =>
      unwrap<AdminReward[]>(
        supabase
          .from('rewards')
          .select('id, title, description, partner, cost_points, stock, is_active')
          .order('cost_points'),
      ),
  });
}

export function useSaveReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...fields }: Partial<AdminReward>) =>
      unwrap<void>(
        id
          ? supabase.from('rewards').update(fields).eq('id', id)
          : supabase.from('rewards').insert(fields),
      ),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      queryClient.invalidateQueries({ queryKey: ['rewards'] });
    },
  });
}

export function useBulletins() {
  return useQuery({
    queryKey: ['admin', 'bulletins'],
    queryFn: () =>
      unwrap<Bulletin[]>(
        supabase
          .from('doe_bulletins')
          .select('id, effective_date, fuel_type, region, change_min, change_max, source_url')
          .order('effective_date', { ascending: false })
          .order('fuel_type')
          .limit(60),
      ),
  });
}

export function useAddBulletins() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rows: Omit<Bulletin, 'id' | 'region'>[]) =>
      unwrap<void>(
        supabase
          .from('doe_bulletins')
          .upsert(rows, { onConflict: 'effective_date,fuel_type,region' }),
      ),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      queryClient.invalidateQueries({ queryKey: ['doe-bulletin'] });
    },
  });
}

export function useDeleteBulletin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap<void>(supabase.from('doe_bulletins').delete().eq('id', id)),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      queryClient.invalidateQueries({ queryKey: ['doe-bulletin'] });
    },
  });
}

export function useAuditLog() {
  return useQuery({
    queryKey: ['admin', 'log'],
    queryFn: () => unwrap<AuditEntry[]>(supabase.rpc('admin_recent_actions')),
  });
}

/** Short message for a failed admin action. */
export function adminErrorMessage(error: unknown): string {
  const message = (error as { message?: string } | null)?.message ?? '';
  switch (message) {
    case 'not_admin':
      return 'Your account is not an admin.';
    case 'already_decided':
      return 'Someone already decided this price.';
    case 'cannot_ban_self':
      return 'You can’t ban yourself.';
    case 'cannot_ban_admin':
      return 'Admins can’t be banned. Remove their admin role first.';
    case 'user_not_found':
      return 'That user no longer exists.';
  }
  if (/duplicate key/i.test(message)) return 'That already exists.';
  if (/fetch|network/i.test(message)) return 'No connection. Try again.';
  return 'Something went wrong. Try again.';
}
