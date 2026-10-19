import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/button';
import { Logo } from '@/components/logo';

// Figma: "Landing Page" (5:41).
export default function Welcome() {
  const { t } = useTranslation();
  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-1 items-center justify-center px-8">
        <Logo size={220} />
        <Text className="mt-4 max-w-xs text-center text-base text-ink-muted">
          {t('welcome.tagline')}
        </Text>
        <View className="mt-10 w-full max-w-sm gap-3">
          <Button
            label={t('welcome.logIn')}
            variant="primary"
            onPress={() => router.push('/login')}
          />
          <Button
            label={t('welcome.signUp')}
            variant="secondary"
            onPress={() => router.push('/sign-up')}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
