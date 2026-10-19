import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { useThemeColors } from '@/theme/theme';

// Building blocks for the admin console. The console is a staff tool, so it is English only and
// laid out for a laptop browser first; it still works on a phone.

type PageProps = {
  title: string;
  children: ReactNode;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
};

export function AdminPage({ title, children, loading, error, onRefresh, refreshing }: PageProps) {
  const theme = useThemeColors();
  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader title={title} fallback="/admin" />
      <ScrollView
        contentContainerClassName="px-4 py-5"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} />
          ) : undefined
        }>
        <View className="w-full max-w-3xl gap-4 self-center">
          {error ? (
            <Text accessibilityRole="alert" className="rounded-xl bg-danger p-3 text-sm text-white">
              {error}
            </Text>
          ) : null}
          {loading ? <ActivityIndicator color={theme.ink} className="py-10" /> : children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <View className={`gap-2 rounded-2xl border border-line bg-surface p-4 ${className ?? ''}`}>
      {children}
    </View>
  );
}

const pillTones = {
  neutral: 'bg-sky text-ink',
  warn: 'bg-fuel text-navy',
  danger: 'bg-danger text-white',
  good: 'bg-brand text-navy',
  info: 'bg-navy-600 text-white',
} as const;

export function Pill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: keyof typeof pillTones;
}) {
  return (
    <Text
      className={`self-start overflow-hidden rounded-full px-2 py-0.5 font-semibold text-xs ${pillTones[tone]}`}>
      {label}
    </Text>
  );
}

export function Stat({
  label,
  value,
  tone,
  onPress,
}: {
  label: string;
  value: number | undefined;
  tone?: 'warn';
  onPress?: () => void;
}) {
  const highlight = tone === 'warn' && (value ?? 0) > 0;
  return (
    <Pressable
      accessibilityRole={onPress ? 'link' : undefined}
      accessibilityLabel={`${label}: ${value ?? 0}`}
      disabled={!onPress}
      onPress={onPress}
      className={`min-w-[30%] flex-1 rounded-2xl border p-3 ${highlight ? 'border-fuel bg-fuel/20' : 'border-line'} ${onPress ? 'active:bg-sky' : ''}`}>
      <Text className="font-black text-2xl text-ink">{value ?? '–'}</Text>
      <Text className="text-xs text-ink-muted">{label}</Text>
    </Pressable>
  );
}

export function NavRow({
  icon,
  label,
  hint,
  onPress,
  first,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  hint?: string;
  onPress: () => void;
  first?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityHint={hint}
      onPress={onPress}
      className={`min-h-12 flex-row items-center gap-3 px-4 py-3.5 active:bg-sky ${first ? '' : 'border-t border-line'}`}>
      <Ionicons name={icon} size={20} className="text-emphasis" />
      <View className="flex-1">
        <Text className="text-base text-ink">{label}</Text>
        {hint ? <Text className="text-xs text-ink-muted">{hint}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} className="text-ink-subtle" />
    </Pressable>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <Text className="py-8 text-center text-sm text-ink-muted">{children}</Text>;
}
