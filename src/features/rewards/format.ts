import i18n from '@/i18n';

export type Tier = { name: string; min: number };

/** "Gold Contributor", the rank label from the prototype's points panel. */
export function tierLabel(tier: string | null | undefined): string {
  return i18n.t('tiers.label', { tier: tier ?? 'Bronze' });
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

/** Badge colours (Tailwind classes) for each voucher state; labels are vouchers.states.* */
export const voucherStateStyles = {
  active: { box: 'bg-brand/15', text: 'text-brand' },
  used: { box: 'bg-line/60', text: 'text-ink-muted' },
  expired: { box: 'bg-line/60', text: 'text-ink-muted' },
  cancelled: { box: 'bg-line/60', text: 'text-ink-muted' },
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
  report_verified: 'profile.reasons.reportVerified',
  vote_matched: 'profile.reasons.voteMatched',
  reward_redeemed: 'profile.reasons.rewardRedeemed',
};

/** Label for a points-ledger entry. */
export function reasonLabel(reason: string): string {
  return i18n.t(reasons[reason] ?? 'profile.reasons.other');
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
  const t = i18n.t.bind(i18n);
  const e = (error ?? {}) as { message?: string; details?: string | null };
  switch (e.message) {
    case 'not_enough_points':
      return e.details
        ? t('rewards.errors.notEnough', { count: Number(e.details) })
        : t('rewards.errors.notEnoughGeneric');
    case 'out_of_stock':
      return t('rewards.errors.outOfStock');
    case 'reward_unavailable':
      return t('rewards.unavailable');
    case 'not_signed_in':
      return t('common.sessionExpired');
    case 'banned':
      return t('common.banned');
  }
  if (error instanceof TypeError || /fetch|network/i.test(e.message ?? '')) {
    return t('common.networkError');
  }
  return t('common.genericError');
}
