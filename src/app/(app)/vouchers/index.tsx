import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Notice } from '@/components/notice';
import { ScreenHeader } from '@/components/screen-header';
import { useVouchers } from '@/features/rewards/api';
import {
  formatDate,
  voucherState,
  voucherStateStyles as stateStyles,
} from '@/features/rewards/format';

export default function Vouchers() {
  const vouchers = useVouchers();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScreenHeader title="My vouchers" fallback="/rewards" />
      <ScrollView contentContainerClassName="px-4 py-4">
        <View className="w-full max-w-md gap-3 self-center">
          {vouchers.isPending ? <ActivityIndicator color="#007BFF" /> : null}
          {vouchers.isError ? <Notice tone="error" message="Couldn’t load your vouchers." /> : null}
          {vouchers.data?.length === 0 ? (
            <View className="items-center gap-2 py-10">
              <Ionicons name="ticket-outline" size={40} color="#B3B3B3" />
              <Text className="text-center text-base text-ink-muted">
                No vouchers yet. Redeem a reward with your points and it appears here.
              </Text>
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
                className="flex-row items-center gap-3 rounded-2xl border border-line bg-white p-4 active:bg-sky">
                <Ionicons
                  name="ticket"
                  size={24}
                  color={state === 'active' ? '#00BF63' : '#B3B3B3'}
                />
                <View className="flex-1">
                  <Text className="font-bold text-base text-ink">
                    {v.reward?.title ?? 'Reward'}
                  </Text>
                  <Text className="text-xs text-ink-muted">
                    {v.code} ·{' '}
                    {state === 'active'
                      ? `valid until ${formatDate(v.expires_at)}`
                      : `redeemed ${formatDate(v.created_at)}`}
                  </Text>
                </View>
                <View className={`rounded-full px-2 py-0.5 ${style.box}`}>
                  <Text className={`font-semibold text-[11px] ${style.text}`}>{style.label}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
