import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

type Tone = 'success' | 'info' | 'error';
type ToastState = {
  toast: { id: number; message: string; tone: Tone } | null;
  show: (message: string, tone?: Tone) => void;
  hide: () => void;
};

/** One toast at a time; a new one replaces the current one. */
export const useToast = create<ToastState>((set) => ({
  toast: null,
  show: (message, tone = 'success') => set({ toast: { id: Date.now(), message, tone } }),
  hide: () => set({ toast: null }),
}));

const tones = {
  success: { icon: 'checkmark-circle', color: '#46D755' },
  info: { icon: 'information-circle', color: '#7FB8FF' },
  error: { icon: 'alert-circle', color: '#FF6B6B' },
} as const;

/** Rendered once in the root layout; the prototype's "+50 points earned" banner. */
export function ToastHost() {
  const { toast, hide } = useToast();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(hide, 4000);
    return () => clearTimeout(id);
  }, [toast, hide]);

  if (!toast) return null;
  const tone = tones[toast.tone];
  return (
    <View
      pointerEvents="box-none"
      className="absolute left-0 right-0 z-50 items-center px-4"
      style={{ top: insets.top + 12 }}>
      <Animated.View
        key={toast.id}
        entering={FadeInUp}
        exiting={FadeOutUp}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        className="max-w-md flex-row items-center gap-2 rounded-full bg-navy px-4 py-2.5 shadow-lg">
        <Ionicons name={tone.icon} size={18} color={tone.color} />
        <Text className="flex-shrink font-semibold text-sm text-white">{toast.message}</Text>
      </Animated.View>
    </View>
  );
}
