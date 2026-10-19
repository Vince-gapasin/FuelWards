import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Notice } from '@/components/notice';
import { useProfile } from '@/features/auth/use-profile';
import { useRewards, useTiers } from '@/features/rewards/api';
import { TierProgress } from '@/features/rewards/tier-progress';

// Figma: "Points" (40:381). Close now goes back to where you were instead of jumping Home, and
// rewards you can't afford yet say how many points you still need.
export default function PointsPanel() {
  const profile = useProfile();
  const rewards = useRewards();
  const tiers = useTiers();
  const stats = profile.data?.stats;
  const balance = stats?.balance ?? 0;
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-navy">
      <View className="items-end px-3 pt-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={10}
          onPress={close}
          className="h-10 w-10 items-center justify-center rounded-full bg-white/10 active:bg-white/20">
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      <View className="w-full max-w-md items-center gap-3 self-center px-6 pb-6">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-star">
          <Ionicons name="star" size={22} color="#011D39" />
        </View>
        <Text className="text-xs uppercase tracking-widest text-white/70">Total points</Text>
        <Text accessibilityRole="header" className="font-black text-5xl text-white">
          {profile.isPending ? '…' : balance}
        </Text>
        {stats?.pending ? (
          <Text className="text-xs text-white/70">+{stats.pending} pending confirmation</Text>
        ) : null}
        {stats && tiers.data ? (
          <TierProgress tier={stats.tier} lifetime={stats.lifetime} tiers={tiers.data} dark />
        ) : null}
      </View>

      <ScrollView
        className="flex-1 rounded-t-3xl bg-sky"
        contentContainerClassName="gap-3 px-4 pb-10 pt-5">
        <View className="w-full max-w-md gap-3 self-center">
          <View className="flex-row gap-2">
            {[
              { label: 'My vouchers', icon: 'ticket-outline', href: '/vouchers' },
              { label: 'Leaderboard', icon: 'trophy-outline', href: '/leaderboard' },
            ].map((link) => (
              <Pressable
                key={link.label}
                accessibilityRole="link"
                onPress={() => router.push(link.href)}
                className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-line bg-white active:bg-line/40">
                <Ionicons name={link.icon as 'ticket-outline'} size={18} color="#011D39" />
                <Text className="font-semibold text-sm text-navy">{link.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text className="mt-2 font-bold text-lg text-ink">Redeem rewards</Text>
          {rewards.isPending ? <ActivityIndicator color="#007BFF" /> : null}
          {rewards.isError ? <Notice tone="error" message="Couldn’t load rewards." /> : null}
          {rewards.data?.length === 0 ? (
            <Text className="text-sm text-ink-muted">No rewards are available right now.</Text>
          ) : null}
          {rewards.data?.map((reward) => {
            const short = reward.cost_points - balance;
            const soldOut = reward.stock === 0;
            return (
              <Pressable
                key={reward.id}
                accessibilityRole="button"
                accessibilityLabel={`${reward.title}, ${reward.cost_points} points`}
                onPress={() => router.push(`/rewards/${reward.id}`)}
                className="flex-row items-center gap-3 rounded-2xl border border-line bg-white p-4 active:bg-line/30">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-sky">
                  <Ionicons name="pricetag" size={18} color="#007BFF" />
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-base text-ink">{reward.title}</Text>
                  <Text numberOfLines={1} className="text-xs text-ink-muted">
                    {soldOut
                      ? 'Sold out'
                      : short > 0
                        ? `${short} more points needed`
                        : (reward.description ?? reward.partner ?? '')}
                  </Text>
                </View>
                <Text
                  className={`font-bold text-base ${short > 0 || soldOut ? 'text-ink-subtle' : 'text-points'}`}>
                  {reward.cost_points} pts
                </Text>
              </Pressable>
            );
          })}
          <Text className="mt-1 text-center text-xs text-ink-muted">
            Earn points by reporting prices and confirming other drivers’ reports.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
