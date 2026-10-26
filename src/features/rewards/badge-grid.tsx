import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/toast';

import { useBadges } from './api';
import { badgeIcon, newlyEarned, sortBadges, type Badge, type BadgeSummary } from './badges';

/** Badges and the current day streak, for the profile. */
export function BadgeGrid({ summary }: { summary: BadgeSummary }) {
  const { t } = useTranslation();
  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text accessibilityRole="header" className="font-bold text-lg text-ink">
          {t('badges.title')}
        </Text>
        <View className="flex-row items-center gap-1">
          <Ionicons name="flame" size={16} className="text-points" />
          <Text className="text-sm text-ink">
            {summary.current_streak > 0
              ? t('badges.streak', { count: summary.current_streak })
              : t('badges.noStreak')}
          </Text>
        </View>
      </View>
      {summary.best_streak > 1 ? (
        <Text className="-mt-2 text-xs text-ink-muted">
          {t('badges.best', { count: summary.best_streak })}
        </Text>
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        {sortBadges(summary.badges).map((badge) => (
          <BadgeTile key={badge.code} badge={badge} />
        ))}
      </View>
    </View>
  );
}

function BadgeTile({ badge }: { badge: Badge }) {
  const { t } = useTranslation();
  const earned = Boolean(badge.earned_at);
  const name = t(`badges.names.${badge.code}`, { defaultValue: badge.code });
  const status = earned
    ? t('badges.earned')
    : t('badges.progress', { progress: badge.progress, goal: badge.goal });
  return (
    <View
      accessible
      accessibilityLabel={`${name}. ${status}. ${t(`badges.hints.${badge.code}`, { defaultValue: '' })}`}
      className={`w-[31%] min-w-[96px] flex-grow items-center gap-1 rounded-2xl p-3 ${earned ? 'bg-sky' : 'border border-dashed border-line-strong'}`}>
      <Ionicons
        name={badgeIcon(badge.code)}
        size={26}
        className={earned ? 'text-emphasis' : 'text-ink-subtle'}
      />
      <Text numberOfLines={2} className="text-center font-semibold text-xs text-ink">
        {name}
      </Text>
      <Text className="text-xs text-ink-muted">
        {earned ? t('badges.earned') : `${badge.progress}/${badge.goal}`}
      </Text>
    </View>
  );
}

/**
 * Shows a toast when a badge is earned. Compares each refresh with the previous one (including
 * the copy saved offline), so a badge earned while the app was closed is celebrated on next open.
 */
export function useBadgeToasts() {
  const { t } = useTranslation();
  const { data } = useBadges();
  const showToast = useToast((s) => s.show);
  const previous = useRef<Badge[] | undefined>(undefined);
  useEffect(() => {
    if (!data) return;
    const fresh = newlyEarned(previous.current, data.badges);
    previous.current = data.badges;
    if (fresh.length) {
      showToast(t('badges.newBadge', { name: t(`badges.names.${fresh[0]}`) }));
    }
  }, [data, showToast, t]);
}
