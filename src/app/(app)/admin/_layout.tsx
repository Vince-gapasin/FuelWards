import { router, Stack } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { useIsAdmin } from '@/features/admin/api';
import { useThemeColors } from '@/theme/theme';

// Admin console. The server checks is_admin on every call; this guard only keeps other users
// from landing on empty screens.
export default function AdminLayout() {
  const theme = useThemeColors();
  const isAdmin = useIsAdmin();

  if (isAdmin.isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator color={theme.ink} />
      </View>
    );
  }

  if (!isAdmin.data) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-surface px-6">
        <Text accessibilityRole="header" className="font-bold text-xl text-ink">
          Admins only
        </Text>
        <Text className="text-center text-base text-ink-muted">
          This part of FuelWards is for the team that moderates prices and rewards.
        </Text>
        <Button label="Back to the map" onPress={() => router.replace('/')} />
      </SafeAreaView>
    );
  }

  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.surface } }}
    />
  );
}
