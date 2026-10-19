import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Logo } from '@/components/logo';
import { Notice } from '@/components/notice';
import { authErrorMessage } from '@/features/auth/errors';
import { useProfile } from '@/features/auth/use-profile';
import { supabase } from '@/lib/supabase';

// Signed-in home. The map, station cards and price reporting replace this body in Phase 2.
export default function Home() {
  const { data, isLoading, error } = useProfile();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    queryClient.clear();
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center justify-between border-b border-line px-4 py-2">
        <View className="flex-row items-center gap-2">
          <Logo size={36} />
          <Text className="font-logo text-xl text-ink">
            Fuel <Text className="text-brand">Rewards</Text>
          </Text>
        </View>
        <View
          accessibilityLabel={`${data?.points ?? 0} points`}
          className="flex-row items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5">
          <Ionicons name="star" size={16} color="#FFDF00" />
          <Text className="font-semibold text-sm text-ink">{data?.points ?? 0}</Text>
        </View>
      </View>

      <View className="w-full max-w-sm flex-1 gap-4 self-center px-6 pt-8">
        {isLoading ? <ActivityIndicator color="#007BFF" /> : null}
        {error ? <Notice tone="error" message={authErrorMessage(error)} /> : null}
        {data ? (
          <Text accessibilityRole="header" className="font-bold text-2xl text-ink">
            Hi, {data.profile.display_name || data.profile.username}!
          </Text>
        ) : null}
        <Notice
          tone="info"
          message="You’re signed in. The fuel price map and rewards arrive in the next build."
        />
        <Button label="Log out" variant="outline" onPress={signOut} loading={signingOut} />
      </View>
    </SafeAreaView>
  );
}
