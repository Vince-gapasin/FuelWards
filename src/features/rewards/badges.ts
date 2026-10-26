import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

/** One badge from the my_badges function. earned_at is null until it is earned. */
export type Badge = { code: string; progress: number; goal: number; earned_at: string | null };

export type BadgeSummary = { badges: Badge[]; current_streak: number; best_streak: number };

type IconName = ComponentProps<typeof Ionicons>['name'];

const icons: Record<string, IconName> = {
  first_price: 'pricetag',
  prices_10: 'pricetags',
  prices_50: 'ribbon',
  first_vote: 'thumbs-up',
  votes_10: 'people',
  explorer: 'compass',
  early_bird: 'sunny',
  streak_3: 'flame',
  streak_7: 'bonfire',
};

export function badgeIcon(code: string): IconName {
  return icons[code] ?? 'medal';
}

/** Codes earned in `next` that were not earned in `previous` (for the "new badge" toast). */
export function newlyEarned(previous: Badge[] | undefined, next: Badge[]): string[] {
  if (!previous) return [];
  const had = new Set(previous.filter((b) => b.earned_at).map((b) => b.code));
  return next.filter((b) => b.earned_at && !had.has(b.code)).map((b) => b.code);
}

/** Earned badges first (oldest first), then locked ones closest to done. */
export function sortBadges(badges: Badge[]): Badge[] {
  const earned = badges
    .filter((b) => b.earned_at)
    .sort((a, b) => Date.parse(a.earned_at!) - Date.parse(b.earned_at!));
  const locked = badges
    .filter((b) => !b.earned_at)
    .sort((a, b) => b.progress / b.goal - a.progress / a.goal);
  return [...earned, ...locked];
}
