import { badgeIcon, newlyEarned, sortBadges, type Badge } from '@/features/rewards/badges';
import { en } from '@/i18n/en';

const badge = (code: string, progress: number, goal: number, earned_at: string | null = null) => ({
  code,
  progress,
  goal,
  earned_at,
});

describe('badges', () => {
  it('has an icon and a name for every badge the database returns', () => {
    const codes = [
      'first_price',
      'prices_10',
      'prices_50',
      'first_vote',
      'votes_10',
      'explorer',
      'early_bird',
      'streak_3',
      'streak_7',
    ];
    for (const code of codes) {
      expect(badgeIcon(code)).not.toBe('medal');
      expect(en.badges.names).toHaveProperty(code);
      expect(en.badges.hints).toHaveProperty(code);
    }
  });

  it('falls back to a generic icon for unknown badges', () => {
    expect(badgeIcon('future_badge')).toBe('medal');
  });

  it('finds badges earned since the last check', () => {
    const before: Badge[] = [
      badge('first_price', 1, 1, '2026-10-20T00:00:00Z'),
      badge('prices_10', 9, 10),
    ];
    const after: Badge[] = [
      badge('first_price', 1, 1, '2026-10-20T00:00:00Z'),
      badge('prices_10', 10, 10, '2026-10-27T00:00:00Z'),
    ];
    expect(newlyEarned(before, after)).toEqual(['prices_10']);
  });

  it('does not celebrate on the first load', () => {
    expect(newlyEarned(undefined, [badge('first_price', 1, 1, '2026-10-20T00:00:00Z')])).toEqual(
      [],
    );
  });

  it('shows earned badges first, then the closest to done', () => {
    const sorted = sortBadges([
      badge('prices_50', 3, 50),
      badge('streak_3', 2, 3),
      badge('first_vote', 1, 1, '2026-10-22T00:00:00Z'),
      badge('first_price', 1, 1, '2026-10-20T00:00:00Z'),
    ]);
    expect(sorted.map((b) => b.code)).toEqual([
      'first_price',
      'first_vote',
      'streak_3',
      'prices_50',
    ]);
  });
});
