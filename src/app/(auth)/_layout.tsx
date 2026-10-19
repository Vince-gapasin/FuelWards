import { Stack } from 'expo-router';

import { useThemeColors } from '@/theme/theme';
export const unstable_settings = { anchor: 'welcome' };

export default function AuthLayout() {
  const theme = useThemeColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: theme.surface },
      }}>
      <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
    </Stack>
  );
}
