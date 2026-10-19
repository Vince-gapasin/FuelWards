import { Text, View } from 'react-native';

import { tierLabel, tierProgress, type Tier } from './format';

type Props = { tier: string; lifetime: number; tiers: Tier[]; dark?: boolean };

/** Tier name plus a bar showing progress to the next tier ("120 more points to Gold"). */
export function TierProgress({ tier, lifetime, tiers, dark }: Props) {
  const { fraction, toNext, next } = tierProgress(lifetime, tiers);
  return (
    <View className="w-full gap-1.5">
      <View className="flex-row items-center justify-between">
        <Text className={`font-semibold text-sm ${dark ? 'text-white' : 'text-ink'}`}>
          {tierLabel(tier)}
        </Text>
        <Text className={`text-xs ${dark ? 'text-white/70' : 'text-ink-muted'}`}>
          {next ? `${toNext} more points to ${next}` : 'Top tier'}
        </Text>
      </View>
      <View
        accessibilityRole="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fraction * 100)}
        className={`h-2 overflow-hidden rounded-full ${dark ? 'bg-white/20' : 'bg-line'}`}>
        <View className="h-full rounded-full bg-star" style={{ width: `${fraction * 100}%` }} />
      </View>
    </View>
  );
}
