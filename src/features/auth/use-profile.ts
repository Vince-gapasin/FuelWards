import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/auth-store';
import { supabase } from '@/lib/supabase';

export type Profile = { id: string; username: string; display_name: string | null };

/** The signed-in user's profile, confirmed points and points still waiting on pending reports. */
export function useProfile() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const [profile, points] = await Promise.all([
        supabase.from('profiles').select('id, username, display_name').eq('id', userId!).single(),
        supabase.rpc('my_points').single(),
      ]);
      if (profile.error) throw profile.error;
      if (points.error) throw points.error;
      const { balance, pending } = points.data as { balance: number; pending: number };
      return { profile: profile.data as Profile, points: balance, pendingPoints: pending };
    },
  });
}
