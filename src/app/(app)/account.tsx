import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { TextLink } from '@/components/text-link';
import { useProfile } from '@/features/auth/use-profile';
import { supabase } from '@/lib/supabase';

// Minimal account screen; the full profile, rank and rewards history come in Phase 4.
export default function Account() {
  const { data } = useProfile();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    queryClient.clear();
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="h-12 justify-center px-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={10}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-sky">
          <Ionicons name="arrow-back" size={24} color="#1D1B20" />
        </Pressable>
      </View>
      <View className="w-full max-w-sm flex-1 gap-5 self-center px-6 pt-4">
        <View className="items-center gap-2">
          <Ionicons name="person-circle" size={72} color="#011D39" />
          <Text accessibilityRole="header" className="font-bold text-2xl text-ink">
            {data?.profile.display_name || data?.profile.username || ' '}
          </Text>
          <View className="flex-row items-center gap-1.5 rounded-full border border-line px-3 py-1.5">
            <Ionicons name="star" size={15} color="#FFDF00" />
            <Text className="font-semibold text-sm text-ink">{data?.points ?? 0} points</Text>
          </View>
        </View>
        <Button label="Log out" variant="outline" onPress={signOut} loading={signingOut} />
        <View className="items-center">
          <TextLink href="/privacy" label="Privacy Notice" />
        </View>
      </View>
    </SafeAreaView>
  );
}
