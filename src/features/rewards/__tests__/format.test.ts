import {
  reasonLabel,
  rewardErrorMessage,
  tierLabel,
  tierProgress,
  voucherState,
} from '@/features/rewards/format';

const tiers = [
  { name: 'Bronze', min: 0 },
  { name: 'Silver', min: 200 },
  { name: 'Gold', min: 500 },
  { name: 'Platinum', min: 1000 },
];

describe('tierProgress', () => {
  it('measures progress within the current tier', () => {
    expect(tierProgress(350, tiers)).toEqual({ fraction: 0.5, toNext: 150, next: 'Gold' });
    expect(tierProgress(0, tiers)).toEqual({ fraction: 0, toNext: 200, next: 'Silver' });
  });

  it('is full at the top tier', () => {
    expect(tierProgress(5000, tiers)).toEqual({ fraction: 1, toNext: null, next: null });
  });

  it('does not depend on the order tiers are listed in', () => {
    expect(tierProgress(350, [...tiers].reverse())).toEqual(tierProgress(350, tiers));
  });

  it('labels tiers like the prototype', () => {
    expect(tierLabel('Gold')).toBe('Gold Contributor');
    expect(tierLabel(null)).toBe('Bronze Contributor');
  });
});

describe('voucherState', () => {
  const now = new Date('2026-10-19T12:00:00Z');
  it.each([
    [{ status: 'issued', expires_at: '2026-11-18T00:00:00Z' }, 'active'],
    [{ status: 'issued', expires_at: '2026-10-01T00:00:00Z' }, 'expired'],
    [{ status: 'used', expires_at: '2026-11-18T00:00:00Z' }, 'used'],
    [{ status: 'cancelled', expires_at: '2026-11-18T00:00:00Z' }, 'cancelled'],
  ])('%p → %s', (voucher, state) => {
    expect(voucherState(voucher, now)).toBe(state);
  });
});

describe('messages', () => {
  it('labels points history entries', () => {
    expect(reasonLabel('report_verified')).toBe('Price confirmed');
    expect(reasonLabel('reward_redeemed')).toBe('Reward redeemed');
    expect(reasonLabel('test')).toBe('Adjustment');
  });

  it('explains redemption errors', () => {
    expect(rewardErrorMessage({ message: 'not_enough_points', details: '120' })).toBe(
      'You need 120 more points for this reward.',
    );
    expect(rewardErrorMessage({ message: 'out_of_stock' })).toBe('This reward just ran out.');
    expect(rewardErrorMessage({ message: 'syntax error' })).toBe(
      'Something went wrong. Please try again.',
    );
  });
});
