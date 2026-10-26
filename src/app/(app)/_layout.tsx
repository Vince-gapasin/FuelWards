import { Stack } from 'expo-router';

import { useAlertNotificationTaps } from '@/features/alerts/push';
import { ConsentGate } from '@/features/auth/consent-gate';
import { useBadgeToasts } from '@/features/rewards/badge-grid';
import { useLivePrices } from '@/features/stations/use-live-prices';
import { useThemeColors } from '@/theme/theme';

export default function AppLayout() {
  const theme = useThemeColors();
  useAlertNotificationTaps();
  useLivePrices();
  useBadgeToasts();
  return (
    <ConsentGate>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.surface } }}>
        <Stack.Screen name="report/[stationId]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="rewards/index" options={{ presentation: 'modal' }} />
      </Stack>
    </ConsentGate>
  );
}
