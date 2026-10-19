export type Tier = { name: string; min: number };

/** "Gold Contributor", the rank label from the prototype's points panel. */
export function tierLabel(tier: string | null | undefined): string {
  return `${tier ?? 'Bronze'} Contributor`;
}

/**
 * Progress through the current tier, 0–1. Tiers are ordered by `min`; past the top tier it's 1.
 */
export function tierProgress(
  lifetime: number,
  tiers: Tier[],
): { fraction: number; toNext: number | null; next: string | null } {
  const sorted = [...tiers].sort((a, b) => a.min - b.min);
  const currentIndex = sorted.reduce((found, t, i) => (lifetime >= t.min ? i : found), 0);
  const current = sorted[currentIndex];
  const next = sorted[currentIndex + 1];
  if (!current || !next) return { fraction: 1, toNext: null, next: null };
  return {
    fraction: Math.min(1, Math.max(0, (lifetime - current.min) / (next.min - current.min))),
    toNext: next.min - lifetime,
    next: next.name,
  };
}

export type VoucherState = 'active' | 'used' | 'expired' | 'cancelled';

/** Badge colours (Tailwind classes) for each voucher state. */
export const voucherStateStyles = {
  active: { label: 'Active', box: 'bg-brand/15', text: 'text-brand' },
  used: { label: 'Used', box: 'bg-line/60', text: 'text-ink-muted' },
  expired: { label: 'Expired', box: 'bg-line/60', text: 'text-ink-muted' },
  cancelled: { label: 'Cancelled', box: 'bg-line/60', text: 'text-ink-muted' },
} as const;

export function voucherState(
  v: { status: string; expires_at: string },
  now: Date = new Date(),
): VoucherState {
  if (v.status === 'used') return 'used';
  if (v.status === 'cancelled') return 'cancelled';
  if (v.status === 'expired' || new Date(v.expires_at) <= now) return 'expired';
  return 'active';
}

const reasons: Record<string, string> = {
  report_verified: 'Price confirmed',
  vote_matched: 'Helpful vote',
  reward_redeemed: 'Reward redeemed',
};

/** Label for a points-ledger entry. */
export function reasonLabel(reason: string): string {
  return reasons[reason] ?? 'Adjustment';
}

const dateFormat = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

/** Oct 19, 2026 */
export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

/** Message for a failed redemption (codes from the redeem_reward function). */
export function rewardErrorMessage(error: unknown): string {
  const e = (error ?? {}) as { message?: string; details?: string | null };
  switch (e.message) {
    case 'not_enough_points':
      return e.details
        ? `You need ${e.details} more points for this reward.`
        : 'You don’t have enough points for this reward.';
    case 'out_of_stock':
      return 'This reward just ran out.';
    case 'reward_unavailable':
      return 'This reward isn’t available any more.';
    case 'not_signed_in':
      return 'Your session expired. Log in again.';
  }
  if (error instanceof TypeError || /fetch|network/i.test(e.message ?? '')) {
    return 'Can’t reach the server. Check your connection and try again.';
  }
  return 'Something went wrong. Please try again.';
}
