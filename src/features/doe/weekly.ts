import { formatPrice } from '@/features/stations/format';

import { bulletinTone, formatChange } from './bulletin';

/** One fuel from current_weekly_prices: this week's median of drivers' confirmed prices. */
export type WeeklyPrice = {
  week_start: string;
  fuel_type: string;
  median_price: number | string;
  /** Change from last week's median; null when last week had too few stations. */
  change: number | string | null;
  station_count: number;
};

/** "Diesel ₱63.00 (+₱2.00)", or without the change when there isn't enough data for one. */
export function formatWeeklyItem(row: WeeklyPrice, label: string): string {
  const price = formatPrice(Number(row.median_price));
  if (row.change == null) return `${label} ${price}`;
  const change = Number(row.change);
  return `${label} ${price} (${formatChange(change, change)})`;
}

/** Banner colour: up, down, or mixed/unknown (same rules as the DOE bulletin). */
export function weeklyTone(rows: WeeklyPrice[]): 'hike' | 'rollback' | 'mixed' {
  const changes = rows.filter((r) => r.change != null).map((r) => Number(r.change));
  if (changes.length === 0) return 'mixed';
  return bulletinTone(changes.map((c) => ({ change_min: c, change_max: c })));
}

/** The smallest station count behind the figures, for "at 12+ stations". */
export function minStations(rows: WeeklyPrice[]): number {
  return rows.reduce((min, r) => Math.min(min, r.station_count), Infinity);
}
