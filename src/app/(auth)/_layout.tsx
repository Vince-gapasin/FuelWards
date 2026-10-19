import { Stack } from 'expo-router';

export const unstable_settings = { anchor: 'welcome' };

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#FFFFFF' },
      }}>
      <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
    </Stack>
  );
}
