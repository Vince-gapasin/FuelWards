import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/button';
import { Notice } from '@/components/notice';
import { ScreenHeader } from '@/components/screen-header';
import { useToast } from '@/components/toast';
import { useProfile } from '@/features/auth/use-profile';
import { useRedeem, useRewards } from '@/features/rewards/api';
import { rewardErrorMessage } from '@/features/rewards/format';

export default function RewardDetail() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const rewards = useRewards();
  const profile = useProfile();
  const redeem = useRedeem();
  const showToast = useToast((s) => s.show);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reward = rewards.data?.find((r) => r.id === id);
  const balance = profile.data?.points ?? 0;
  const short = reward ? reward.cost_points - balance : 0;
  const soldOut = reward?.stock === 0;

  const onRedeem = async () => {
    setError(null);
    try {
      const result = await redeem.mutateAsync(id);
      showToast(t('rewards.redeemed', { code: result.code }));
      router.replace(`/vouchers/${result.id}`);
    } catch (e) {
      setConfirming(false);
      setError(rewardErrorMessage(e));
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader title={t('rewards.reward')} fallback="/rewards" />
      <ScrollView contentContainerClassName="px-6 py-6">
        <View className="w-full max-w-md gap-5 self-center">
          {rewards.isPending ? <ActivityIndicator color="#007BFF" /> : null}
          {rewards.isSuccess && !reward ? (
            <Notice tone="error" message={t('rewards.unavailable')} />
          ) : null}
          {reward ? (
            <>
              <View className="items-center gap-3 rounded-2xl bg-sky p-6">
                <View className="h-14 w-14 items-center justify-center rounded-full bg-surface">
                  <Ionicons name="pricetag" size={26} color="#007BFF" />
                </View>
                <Text
                  accessibilityRole="header"
                  className="text-center font-bold text-2xl text-ink">
                  {reward.title}
                </Text>
                <Text className="font-bold text-xl text-points">
                  {t('common.points', { count: reward.cost_points })}
                </Text>
              </View>

              {reward.description ? (
                <Text className="text-base text-ink">{reward.description}</Text>
              ) : null}
              <View className="gap-1">
                {reward.partner ? (
                  <Text className="text-sm text-ink-muted">
                    {t('rewards.partner', { name: reward.partner })}
                  </Text>
                ) : null}
                {reward.stock != null ? (
                  <Text className="text-sm text-ink-muted">
                    {soldOut ? t('rewards.soldOut') : t('rewards.left', { count: reward.stock })}
                  </Text>
                ) : null}
                <Text className="text-sm text-ink-muted">{t('rewards.validity')}</Text>
                <Text className="text-sm text-ink-muted">
                  {t('rewards.youHave', { count: balance })}
                </Text>
              </View>

              {error ? <Notice tone="error" message={error} /> : null}

              {soldOut ? (
                <Button label={t('rewards.soldOut')} disabled />
              ) : short > 0 ? (
                <Button label={t('rewards.moreNeeded', { count: short })} disabled />
              ) : confirming ? (
                <View className="gap-3 rounded-2xl border border-line p-4">
                  <Text className="text-center text-base text-ink">
                    {t('rewards.confirmSpend', { cost: reward.cost_points, balance })}
                  </Text>
                  <View className="flex-row gap-2">
                    <Button
                      label={t('common.cancel')}
                      variant="outline"
                      className="flex-1"
                      onPress={() => setConfirming(false)}
                      disabled={redeem.isPending}
                    />
                    <Button
                      label={t('rewards.redeem')}
                      variant="secondary"
                      className="flex-1"
                      onPress={onRedeem}
                      loading={redeem.isPending}
                    />
                  </View>
                </View>
              ) : (
                <Button
                  label={t('rewards.redeemFor', { count: reward.cost_points })}
                  variant="secondary"
                  onPress={() => setConfirming(true)}
                />
              )}
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
