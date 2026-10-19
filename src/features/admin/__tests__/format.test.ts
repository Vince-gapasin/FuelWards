import {
  bulletinRows,
  describeAction,
  isIsoDate,
  nextAdjustmentDate,
  parseChange,
} from '@/features/admin/format';

describe('nextAdjustmentDate', () => {
  it('picks the coming Tuesday in Manila time', () => {
    // Monday 19 Oct 2026, 10:00 Manila
    expect(nextAdjustmentDate(new Date('2026-10-19T02:00:00Z'))).toBe('2026-10-20');
  });

  it('is today on a Tuesday', () => {
    expect(nextAdjustmentDate(new Date('2026-10-20T04:00:00Z'))).toBe('2026-10-20');
  });

  it('uses the Manila date, not UTC', () => {
    // Tuesday 20 Oct 23:30 UTC is already Wednesday 21 Oct in Manila.
    expect(nextAdjustmentDate(new Date('2026-10-20T23:30:00Z'))).toBe('2026-10-27');
  });
});

describe('isIsoDate', () => {
  it('accepts real dates only', () => {
    expect(isIsoDate('2026-10-20')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('20/10/2026')).toBe(false);
  });
});

describe('parseChange', () => {
  it('reads signed peso amounts', () => {
    expect(parseChange('1.10')).toBe(1.1);
    expect(parseChange('+0.5')).toBe(0.5);
    expect(parseChange('-0.50')).toBe(-0.5);
    expect(parseChange('−1.20')).toBe(-1.2);
    expect(parseChange('₱2')).toBe(2);
  });

  it('treats blank as empty and rejects other text', () => {
    expect(parseChange('  ')).toBeNull();
    expect(parseChange('abc')).toBe('invalid');
    expect(parseChange('1.234')).toBe('invalid');
  });
});

describe('bulletinRows', () => {
  const drafts = [
    { fuel_type: 'GAS91', min: '1.10', max: '1.30' },
    { fuel_type: 'DIESEL', min: '-0.50', max: '' },
    { fuel_type: 'KEROSENE', min: '', max: '' },
  ];

  it('skips blank fuels and fills a one-sided range', () => {
    const { rows, error } = bulletinRows('2026-10-20', drafts, 'https://doe.gov.ph/x');
    expect(error).toBeNull();
    expect(rows).toEqual([
      expect.objectContaining({ fuel_type: 'GAS91', change_min: 1.1, change_max: 1.3 }),
      expect.objectContaining({ fuel_type: 'DIESEL', change_min: -0.5, change_max: -0.5 }),
    ]);
    expect(rows[0].source_url).toBe('https://doe.gov.ph/x');
  });

  it('rejects bad input', () => {
    expect(bulletinRows('next week', drafts, '').error).toMatch(/YYYY-MM-DD/);
    expect(bulletinRows('2026-10-20', drafts, 'doe.gov.ph').error).toMatch(/http/);
    expect(
      bulletinRows('2026-10-20', [{ fuel_type: 'GAS95', min: '2', max: '1' }], '').error,
    ).toMatch(/above/);
    expect(
      bulletinRows('2026-10-20', [{ fuel_type: 'GAS95', min: '', max: '' }], '').error,
    ).toMatch(/at least one/);
  });
});

describe('describeAction', () => {
  it('reads like a sentence', () => {
    expect(describeAction('ban', 'profiles')).toBe('banned a user');
    expect(describeAction('update', 'stations')).toBe('updated stations');
  });
});
