import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Notice } from '@/components/notice';
import { ScreenHeader } from '@/components/screen-header';
import { useVoucher } from '@/features/rewards/api';
import {
  formatDate,
  voucherState,
  voucherStateStyles as stateStyles,
} from '@/features/rewards/format';

export default function VoucherDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const voucher = useVoucher(id);
  const v = voucher.data;
  const state = v ? voucherState(v) : null;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScreenHeader title="Voucher" fallback="/vouchers" />
      <ScrollView contentContainerClassName="px-6 py-6">
        <View className="w-full max-w-sm items-center gap-5 self-center">
          {voucher.isPending ? <ActivityIndicator color="#007BFF" /> : null}
          {voucher.isError ? <Notice tone="error" message="Couldn’t load this voucher." /> : null}
          {v && state ? (
            <>
              <Text accessibilityRole="header" className="text-center font-bold text-2xl text-ink">
                {v.reward?.title ?? 'Reward'}
              </Text>
              <View className={`rounded-full px-3 py-1 ${stateStyles[state].box}`}>
                <Text className={`font-semibold text-sm ${stateStyles[state].text}`}>
                  {stateStyles[state].label}
                </Text>
              </View>

              <View
                accessibilityLabel={`QR code for voucher ${v.code}`}
                className={`rounded-2xl border border-line bg-white p-5 ${state === 'active' ? '' : 'opacity-30'}`}>
                <QRCode value={v.code} size={200} color="#011D39" backgroundColor="#FFFFFF" />
              </View>
              <Text selectable className="font-black text-3xl tracking-widest text-navy">
                {v.code}
              </Text>

              <View className="w-full gap-1 rounded-2xl bg-sky p-4">
                <Text className="text-sm text-ink">
                  {state === 'active'
                    ? 'Show this code to the cashier at a partner station.'
                    : state === 'used'
                      ? `Used on ${formatDate(v.used_at ?? v.created_at)}.`
                      : 'This voucher can no longer be used.'}
                </Text>
                <Text className="text-xs text-ink-muted">
                  Redeemed {formatDate(v.created_at)} for {v.points_spent} points · valid until{' '}
                  {formatDate(v.expires_at)}
                </Text>
                {v.reward?.partner ? (
                  <Text className="text-xs text-ink-muted">Partner: {v.reward.partner}</Text>
                ) : null}
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
