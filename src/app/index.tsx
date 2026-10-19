import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Logo } from '@/components/logo';

// Landing screen (Figma: "Landing Page", 5:41). Log In / Sign Up are wired up in Phase 1.
export default function Landing() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center px-8">
        <Logo size={220} />
        <View className="mt-12 w-full max-w-sm gap-3">
          <Button label="Log In" variant="primary" disabled />
          <Button label="Sign Up" variant="secondary" disabled />
        </View>
      </View>
    </SafeAreaView>
  );
}
