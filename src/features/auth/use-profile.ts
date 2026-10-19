import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/auth-store';
import { supabase } from '@/lib/supabase';

export type Profile = { id: string; username: string; display_name: string | null };

export type Stats = {
  balance: number;
  pending: number;
  lifetime: number;
  tier: string;
  next_tier: string | null;
  next_tier_at: number | null;
  verified_reports: number;
  votes: number;
};

/** The signed-in user's profile, points (confirmed and pending), tier and contribution counts. */
export function useProfile() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const [profile, stats] = await Promise.all([
        supabase.from('profiles').select('id, username, display_name').eq('id', userId!).single(),
        supabase.rpc('my_stats').single(),
      ]);
      if (profile.error) throw profile.error;
      if (stats.error) throw stats.error;
      const s = stats.data as Stats;
      return {
        profile: profile.data as Profile,
        stats: s,
        points: s.balance,
        pendingPoints: s.pending,
      };
    },
  });
}
