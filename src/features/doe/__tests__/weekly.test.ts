import { formatWeeklyItem, minStations, weeklyTone, type WeeklyPrice } from '@/features/doe/weekly';

const row = (
  fuel_type: string,
  median_price: number | string,
  change: number | string | null,
  station_count = 5,
): WeeklyPrice => ({ week_start: '2030-01-08', fuel_type, median_price, change, station_count });

describe('weekly prices', () => {
  it('shows the median and the change', () => {
    expect(formatWeeklyItem(row('DIESEL', '63.00', '2.00'), 'Diesel')).toBe(
      'Diesel ₱63.00 (+₱2.00)',
    );
    expect(formatWeeklyItem(row('GAS91', 71, -0.5), 'Reg 91')).toBe('Reg 91 ₱71.00 (−₱0.50)');
  });

  it('leaves out the change when last week had too little data', () => {
    expect(formatWeeklyItem(row('GAS95', 75, null), 'Prem 95')).toBe('Prem 95 ₱75.00');
  });

  it('picks the banner colour from the changes', () => {
    expect(weeklyTone([row('DIESEL', 63, 2), row('GAS91', 71, 0.5)])).toBe('hike');
    expect(weeklyTone([row('DIESEL', 63, -2)])).toBe('rollback');
    expect(weeklyTone([row('DIESEL', 63, 2), row('GAS91', 71, -1)])).toBe('mixed');
    expect(weeklyTone([row('DIESEL', 63, null)])).toBe('mixed');
  });

  it('reports the smallest station count behind the figures', () => {
    expect(minStations([row('DIESEL', 63, 2, 12), row('GAS91', 71, 1, 4)])).toBe(4);
  });
});
