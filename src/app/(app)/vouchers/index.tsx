import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Notice } from '@/components/notice';
import { ScreenHeader } from '@/components/screen-header';
import { useVouchers } from '@/features/rewards/api';
import {
  formatDate,
  voucherState,
  voucherStateStyles as stateStyles,
} from '@/features/rewards/format';

export default function Vouchers() {
  const { t } = useTranslation();
  const vouchers = useVouchers();

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader title={t('vouchers.title')} fallback="/rewards" />
      <ScrollView contentContainerClassName="px-4 py-4">
        <View className="w-full max-w-md gap-3 self-center">
          {vouchers.isPending ? <ActivityIndicator color="#007BFF" /> : null}
          {vouchers.isError ? <Notice tone="error" message={t('vouchers.loadFailed')} /> : null}
          {vouchers.data?.length === 0 ? (
            <View className="items-center gap-2 py-10">
              <Ionicons name="ticket-outline" size={40} className="text-ink-subtle" />
              <Text className="text-center text-base text-ink-muted">{t('vouchers.empty')}</Text>
            </View>
          ) : null}
          {vouchers.data?.map((v) => {
            const state = voucherState(v);
            const style = stateStyles[state];
            return (
              <Pressable
                key={v.id}
                accessibilityRole="button"
                onPress={() => router.push(`/vouchers/${v.id}`)}
                className="flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-4 active:bg-sky">
                <Ionicons
                  name="ticket"
                  size={24}
                  className={state === 'active' ? 'text-brand' : 'text-ink-subtle'}
                />
                <View className="flex-1">
                  <Text className="font-bold text-base text-ink">
                    {v.reward?.title ?? t('rewards.reward')}
                  </Text>
                  <Text className="text-xs text-ink-muted">
                    {v.code} ·{' '}
                    {state === 'active'
                      ? t('vouchers.validUntil', { date: formatDate(v.expires_at) })
                      : t('vouchers.redeemedOn', { date: formatDate(v.created_at) })}
                  </Text>
                </View>
                <View className={`rounded-full px-2 py-0.5 ${style.box}`}>
                  <Text className={`font-semibold text-[11px] ${style.text}`}>
                    {t(`vouchers.states.${state}`)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
