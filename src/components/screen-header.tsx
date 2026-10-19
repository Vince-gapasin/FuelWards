import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

type Props = {
  title: string;
  /** "close" for screens opened as a panel, "back" for pushed screens. */
  variant?: 'back' | 'close';
  /** Where to go if there's no history (e.g. the page was opened directly on web). */
  fallback?: Href;
  right?: ReactNode;
};

export function ScreenHeader({ title, variant = 'back', fallback = '/', right }: Props) {
  const leave = () => (router.canGoBack() ? router.back() : router.replace(fallback));
  const button = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={variant === 'close' ? 'Close' : 'Back'}
      hitSlop={10}
      onPress={leave}
      className="h-10 w-10 items-center justify-center rounded-full active:bg-sky">
      <Ionicons name={variant === 'close' ? 'close' : 'arrow-back'} size={24} color="#1D1B20" />
    </Pressable>
  );
  return (
    <View className="flex-row items-center gap-1 border-b border-line px-2 py-1.5">
      {variant === 'back' ? button : <View className="w-2" />}
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        className="flex-1 font-bold text-lg text-ink">
        {title}
      </Text>
      {right}
      {variant === 'close' ? button : null}
    </View>
  );
}
