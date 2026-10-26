import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/auth-store';
import { supabase } from '@/lib/supabase';

import type { BadgeSummary } from './badges';
import type { Tier } from './format';

export type Reward = {
  id: string;
  title: string;
  description: string | null;
  partner: string | null;
  cost_points: number;
  stock: number | null;
};

export type Voucher = {
  id: string;
  code: string;
  status: string;
  points_spent: number;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  reward: { title: string; partner: string | null; description: string | null } | null;
};

export type LeaderboardRow = {
  rank: number;
  username: string;
  display_name: string | null;
  points: number;
  tier: string;
  is_me: boolean;
};

export type LedgerEntry = { id: number; delta: number; reason: string; created_at: string };

export function useRewards() {
  return useQuery({
    queryKey: ['rewards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rewards')
        .select('id, title, description, partner, cost_points, stock')
        .order('cost_points');
      if (error) throw error;
      return data as Reward[];
    },
  });
}

export function useTiers() {
  return useQuery({
    queryKey: ['tiers'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'tiers')
        .single();
      if (error) throw error;
      return data.value as Tier[];
    },
  });
}

const voucherColumns =
  'id, code, status, points_spent, created_at, expires_at, used_at, reward:rewards(title, partner, description)';

export function useVouchers() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery({
    queryKey: ['vouchers', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('redemptions')
        .select(voucherColumns)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as Voucher[];
    },
  });
}

export function useVoucher(id: string) {
  return useQuery({
    queryKey: ['voucher', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('redemptions')
        .select(voucherColumns)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as unknown as Voucher;
    },
  });
}

export function useRedeem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rewardId: string) => {
      const { data, error } = await supabase.rpc('redeem_reward', { p_reward_id: rewardId });
      if (error) throw error;
      return data as { id: string; code: string; expires_at: string; balance: number };
    },
    onSuccess: () =>
      Promise.all(
        ['profile', 'rewards', 'vouchers', 'points-history', 'leaderboard'].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      ),
  });
}

export function useLeaderboard(period: 'week' | 'all') {
  return useQuery({
    queryKey: ['leaderboard', period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('leaderboard', { p_period: period });
      if (error) throw error;
      return data as LeaderboardRow[];
    },
  });
}

export function usePointsHistory() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery({
    queryKey: ['points-history', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('points_ledger')
        .select('id, delta, reason, created_at')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as LedgerEntry[];
    },
  });
}

/** Badges and day streaks. Shares the profile key so reports and votes refresh it too. */
export function useBadges() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery({
    queryKey: ['profile', 'badges', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_badges');
      if (error) throw error;
      return data as BadgeSummary;
    },
  });
}
