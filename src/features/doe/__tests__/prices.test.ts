import {
  formatRange,
  formatWeek,
  priceFor,
  roundCenter,
  weekKey,
  type DoePrice,
} from '@/features/doe/prices';

const row = (fuel_type: string, region = 'V'): DoePrice => ({
  region,
  region_name: 'Bicol Region',
  week_start: '2026-10-27',
  week_end: '2026-11-02',
  fuel_type,
  price_min: '79.45',
  price_max: '109.60',
  typical_price: '87.50',
  area_count: 9,
  source_url: 'https://example.test/v.pdf',
});

describe('DOE weekly prices', () => {
  it('formats the monitoring week', () => {
    expect(formatWeek('2026-10-20', '2026-10-26')).toBe('Oct 20–26');
    expect(formatWeek('2026-10-27', '2026-11-02')).toBe('Oct 27 – Nov 2');
  });

  it('formats a price range', () => {
    expect(formatRange('79.45', '109.6')).toBe('₱79.45–₱109.60');
    expect(formatRange(88.8, '88.80')).toBe('₱88.80');
  });

  it('finds a fuel', () => {
    const rows = [row('GAS91'), row('DIESEL')];
    expect(priceFor(rows, 'DIESEL')?.fuel_type).toBe('DIESEL');
    expect(priceFor(rows, 'KEROSENE')).toBeUndefined();
  });

  it('keys a dismissal by region and week', () => {
    expect(weekKey([row('GAS91', 'IV-A')])).toBe('IV-A:2026-10-27');
    expect(weekKey([])).toBeNull();
  });

  it('rounds the map centre to about 5 km', () => {
    expect(roundCenter(14.6008, 121.0067)).toEqual({ lat: 14.6, lng: 121 });
    expect(roundCenter(13.6291, 123.1874)).toEqual({ lat: 13.65, lng: 123.2 });
  });
});
