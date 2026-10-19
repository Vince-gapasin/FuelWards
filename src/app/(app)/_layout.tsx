import { Stack } from 'expo-router';

import { useAlertNotificationTaps } from '@/features/alerts/push';
import { ConsentGate } from '@/features/auth/consent-gate';
import { useThemeColors } from '@/theme/theme';

export default function AppLayout() {
  const theme = useThemeColors();
  useAlertNotificationTaps();
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
