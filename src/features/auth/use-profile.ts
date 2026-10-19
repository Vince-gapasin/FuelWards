import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/auth-store';
import { supabase } from '@/lib/supabase';

export type Profile = { id: string; username: string; display_name: string | null };

/** The signed-in user's profile and point balance. */
export function useProfile() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const [profile, points] = await Promise.all([
        supabase.from('profiles').select('id, username, display_name').eq('id', userId!).single(),
        supabase.from('user_points').select('balance').eq('user_id', userId!).maybeSingle(),
      ]);
      if (profile.error) throw profile.error;
      if (points.error) throw points.error;
      return { profile: profile.data as Profile, points: (points.data?.balance as number) ?? 0 };
    },
  });
}
