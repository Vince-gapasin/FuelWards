import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '@/components/logo';

type Props = {
  children: ReactNode;
  /** Where the back arrow goes. Omit to hide it. */
  backTo?: Href;
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
};

/** Shared layout for the sign-in screens: back arrow, logo, centred form column. */
export function AuthScreen({ children, backTo, title, subtitle, showLogo = true }: Props) {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1">
        <ScrollView
          contentContainerClassName="flex-grow px-6 pb-8"
          keyboardShouldPersistTaps="handled">
          <View className="h-12 justify-center">
            {backTo ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                hitSlop={10}
                onPress={() => (router.canGoBack() ? router.back() : router.replace(backTo))}
                className="h-10 w-10 items-center justify-center rounded-full active:bg-sky">
                <Ionicons name="arrow-back" size={24} color="#1D1B20" />
              </Pressable>
            ) : null}
          </View>
          <View className="w-full max-w-sm flex-1 self-center">
            {showLogo ? (
              <View className="mb-6 items-center">
                <Logo size={150} />
              </View>
            ) : (
              <View className="h-16" />
            )}
            {title ? (
              <Text accessibilityRole="header" className="mb-1 font-bold text-2xl text-ink">
                {title}
              </Text>
            ) : null}
            {subtitle ? <Text className="mb-5 text-base text-ink-muted">{subtitle}</Text> : null}
            <View className="gap-4">{children}</View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
