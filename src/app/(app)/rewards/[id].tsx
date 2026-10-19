import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Notice } from '@/components/notice';
import { ScreenHeader } from '@/components/screen-header';
import { useToast } from '@/components/toast';
import { useProfile } from '@/features/auth/use-profile';
import { useRedeem, useRewards } from '@/features/rewards/api';
import { rewardErrorMessage } from '@/features/rewards/format';

export default function RewardDetail() {
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
      showToast(`Redeemed! Your code is ${result.code}.`);
      router.replace(`/vouchers/${result.id}`);
    } catch (e) {
      setConfirming(false);
      setError(rewardErrorMessage(e));
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScreenHeader title="Reward" fallback="/rewards" />
      <ScrollView contentContainerClassName="px-6 py-6">
        <View className="w-full max-w-md gap-5 self-center">
          {rewards.isPending ? <ActivityIndicator color="#007BFF" /> : null}
          {rewards.isSuccess && !reward ? (
            <Notice tone="error" message="This reward isn’t available any more." />
          ) : null}
          {reward ? (
            <>
              <View className="items-center gap-3 rounded-2xl bg-sky p-6">
                <View className="h-14 w-14 items-center justify-center rounded-full bg-white">
                  <Ionicons name="pricetag" size={26} color="#007BFF" />
                </View>
                <Text
                  accessibilityRole="header"
                  className="text-center font-bold text-2xl text-ink">
                  {reward.title}
                </Text>
                <Text className="font-bold text-xl text-points">{reward.cost_points} points</Text>
              </View>

              {reward.description ? (
                <Text className="text-base text-ink">{reward.description}</Text>
              ) : null}
              <View className="gap-1">
                {reward.partner ? (
                  <Text className="text-sm text-ink-muted">Partner: {reward.partner}</Text>
                ) : null}
                {reward.stock != null ? (
                  <Text className="text-sm text-ink-muted">
                    {soldOut ? 'Sold out' : `${reward.stock} left`}
                  </Text>
                ) : null}
                <Text className="text-sm text-ink-muted">
                  Valid for 30 days after you redeem it.
                </Text>
                <Text className="text-sm text-ink-muted">You have {balance} points.</Text>
              </View>

              {error ? <Notice tone="error" message={error} /> : null}

              {soldOut ? (
                <Button label="Sold out" disabled />
              ) : short > 0 ? (
                <Button label={`${short} more points needed`} disabled />
              ) : confirming ? (
                <View className="gap-3 rounded-2xl border border-line p-4">
                  <Text className="text-center text-base text-ink">
                    Spend {reward.cost_points} of your {balance} points on this reward?
                  </Text>
                  <View className="flex-row gap-2">
                    <Button
                      label="Cancel"
                      variant="outline"
                      className="flex-1"
                      onPress={() => setConfirming(false)}
                      disabled={redeem.isPending}
                    />
                    <Button
                      label="Redeem"
                      variant="secondary"
                      className="flex-1"
                      onPress={onRedeem}
                      loading={redeem.isPending}
                    />
                  </View>
                </View>
              ) : (
                <Button
                  label={`Redeem for ${reward.cost_points} points`}
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
