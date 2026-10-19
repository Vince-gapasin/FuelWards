import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Notice } from '@/components/notice';
import { ScreenHeader } from '@/components/screen-header';
import { useVoucher } from '@/features/rewards/api';
import {
  formatDate,
  voucherState,
  voucherStateStyles as stateStyles,
} from '@/features/rewards/format';

export default function VoucherDetail() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const voucher = useVoucher(id);
  const v = voucher.data;
  const state = v ? voucherState(v) : null;

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader title={t('vouchers.voucher')} fallback="/vouchers" />
      <ScrollView contentContainerClassName="px-6 py-6">
        <View className="w-full max-w-sm items-center gap-5 self-center">
          {voucher.isPending ? <ActivityIndicator color="#007BFF" /> : null}
          {voucher.isError ? <Notice tone="error" message={t('vouchers.loadOneFailed')} /> : null}
          {v && state ? (
            <>
              <Text accessibilityRole="header" className="text-center font-bold text-2xl text-ink">
                {v.reward?.title ?? t('rewards.reward')}
              </Text>
              <View className={`rounded-full px-3 py-1 ${stateStyles[state].box}`}>
                <Text className={`font-semibold text-sm ${stateStyles[state].text}`}>
                  {t(`vouchers.states.${state}`)}
                </Text>
              </View>

              <View
                accessibilityLabel={t('vouchers.qrLabel', { code: v.code })}
                className={`rounded-2xl border border-line bg-surface p-5 ${state === 'active' ? '' : 'opacity-30'}`}>
                <QRCode value={v.code} size={200} color="#011D39" backgroundColor="#FFFFFF" />
              </View>
              <Text selectable className="font-black text-3xl tracking-widest text-emphasis">
                {v.code}
              </Text>

              <View className="w-full gap-1 rounded-2xl bg-sky p-4">
                <Text className="text-sm text-ink">
                  {state === 'active'
                    ? t('vouchers.showCashier')
                    : state === 'used'
                      ? t('vouchers.usedOn', { date: formatDate(v.used_at ?? v.created_at) })
                      : t('vouchers.cantUse')}
                </Text>
                <Text className="text-xs text-ink-muted">
                  {t('vouchers.details', {
                    date: formatDate(v.created_at),
                    points: v.points_spent,
                    until: formatDate(v.expires_at),
                  })}
                </Text>
                {v.reward?.partner ? (
                  <Text className="text-xs text-ink-muted">
                    {t('rewards.partner', { name: v.reward.partner })}
                  </Text>
                ) : null}
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
