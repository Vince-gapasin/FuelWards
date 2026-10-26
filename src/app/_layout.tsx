import '@/global.css';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import { LilitaOne_400Regular } from '@expo-google-fonts/lilita-one';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { ToastHost } from '@/components/toast';
import { useAuthListener, useAuthStore, useIsSignedIn } from '@/features/auth/auth-store';
import { applyLanguagePreference, loadLanguagePreference } from '@/i18n';
import { initMonitoring, withMonitoring } from '@/lib/monitoring';
import { CACHE_MAX_AGE, createQueryClient, queryPersister } from '@/lib/query-client';
import { ThemeRoot, useThemeColors } from '@/theme/theme';

// Queries that are only useful fresh are not saved for offline use.
const NOT_PERSISTED = new Set(['pending-reports', 'alerts', 'leaderboard', 'admin']);

initMonitoring();
SplashScreen.preventAutoHideAsync();

export default withMonitoring(RootLayout);

function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_900Black,
    LilitaOne_400Regular,
  });
  useAuthListener();
  const authReady = useAuthStore((s) => s.initialized);
  // Apply the saved language before the first screen, so it never flashes in English.
  const [languageReady, setLanguageReady] = useState(false);
  useEffect(() => {
    loadLanguagePreference()
      .then(applyLanguagePreference)
      .finally(() => setLanguageReady(true));
  }, []);
  const ready = (fontsLoaded || Boolean(fontError)) && authReady && languageReady;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        // Bump when a cached shape changes, so old offline copies are dropped instead of misread.
        buster: '2',
        persister: queryPersister,
        maxAge: CACHE_MAX_AGE,
        dehydrateOptions: {
          shouldDehydrateQuery: (q) =>
            q.state.status === 'success' && !NOT_PERSISTED.has(String(q.queryKey[0])),
        },
      }}>
      <ThemeRoot>
        <ThemedStatusBar />
        <RootNavigator />
        <ToastHost />
      </ThemeRoot>
    </PersistQueryClientProvider>
  );
}

function ThemedStatusBar() {
  const { dark } = useThemeColors();
  return <StatusBar style={dark ? 'light' : 'dark'} />;
}

function RootNavigator() {
  const theme = useThemeColors();
  const signedIn = useIsSignedIn();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.surface } }}>
      <Stack.Protected guard={signedIn} redirectTo="/welcome">
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn} redirectTo="/">
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Screen name="privacy" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
