import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Notice } from '@/components/notice';
import { ScreenHeader } from '@/components/screen-header';
import { useLeaderboard } from '@/features/rewards/api';

const medals = ['#FFDF00', '#C0C6CF', '#D08A4E'];

export default function Leaderboard() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<'week' | 'all'>('week');
  const board = useLeaderboard(period);
  const rows = board.data ?? [];
  // The caller's row is appended when they're outside the top 50.
  const top = rows.filter((r) => r.rank <= 50);
  const me = rows.find((r) => r.is_me && r.rank > 50);

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader title={t('leaderboard.title')} fallback="/rewards" />
      <View className="w-full max-w-md flex-row gap-2 self-center px-4 pt-4">
        {(
          [
            ['week', t('leaderboard.week')],
            ['all', t('leaderboard.all')],
          ] as const
        ).map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            aria-selected={period === value}
            onPress={() => setPeriod(value)}
            hitSlop={{ top: 4, bottom: 4 }}
            className={`h-9 flex-1 items-center justify-center rounded-full border ${
              period === value ? 'border-navy bg-navy' : 'border-line bg-surface active:bg-sky'
            }`}>
            <Text
              className={`font-semibold text-sm ${period === value ? 'text-white' : 'text-ink'}`}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerClassName="px-4 py-4">
        <View className="w-full max-w-md gap-2 self-center">
          {board.isPending ? <ActivityIndicator color="#0066D6" /> : null}
          {board.isError ? <Notice tone="error" message={t('leaderboard.loadFailed')} /> : null}
          {board.isSuccess && top.length === 0 ? (
            <View className="items-center gap-2 py-10">
              <Ionicons name="trophy-outline" size={40} className="text-ink-subtle" />
              <Text className="text-center text-base text-ink-muted">
                {period === 'week' ? t('leaderboard.emptyWeek') : t('leaderboard.emptyAll')}
              </Text>
            </View>
          ) : null}
          {[...top, ...(me ? [me] : [])].map((row) => (
            <View
              key={`${row.rank}-${row.username}`}
              className={`flex-row items-center gap-3 rounded-2xl border p-3 ${
                row.is_me ? 'border-action bg-sky' : 'border-line bg-surface'
              }`}>
              <View
                className="h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: medals[row.rank - 1] ?? '#E3F0FD' }}>
                <Text className="font-bold text-sm text-emphasis">{row.rank}</Text>
              </View>
              <View className="flex-1">
                <Text numberOfLines={1} className="font-semibold text-base text-ink">
                  {row.display_name || row.username}
                  {row.is_me ? t('leaderboard.you') : ''}
                </Text>
                <Text className="text-xs text-ink-muted">
                  @{row.username} · {row.tier}
                </Text>
              </View>
              <Text className="font-bold text-base text-points">
                {t('common.pts', { count: row.points })}
              </Text>
            </View>
          ))}
          <Text className="mt-2 text-center text-xs text-ink-muted">
            {period === 'week' ? t('leaderboard.footerWeek') : t('leaderboard.footerAll')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
