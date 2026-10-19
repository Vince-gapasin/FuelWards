import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Logo } from '@/components/logo';

// Figma: "Landing Page" (5:41).
export default function Welcome() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center px-8">
        <Logo size={220} />
        <Text className="mt-4 max-w-xs text-center text-base text-ink-muted">
          Find the cheapest fuel near you. Earn rewards for keeping prices up to date.
        </Text>
        <View className="mt-10 w-full max-w-sm gap-3">
          <Button label="Log In" variant="primary" onPress={() => router.push('/login')} />
          <Button label="Sign Up" variant="secondary" onPress={() => router.push('/sign-up')} />
        </View>
      </View>
    </SafeAreaView>
  );
}
