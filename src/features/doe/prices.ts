import { formatPrice } from '@/features/stations/format';

/**
 * One fuel from doe_prices_for_station / doe_prices_near: the DOE's latest weekly monitoring for
 * a region. Numbers can arrive as strings (Postgres numeric).
 */
export type DoePrice = {
  region: string;
  region_name: string;
  week_start: string;
  week_end: string;
  fuel_type: string;
  price_min: number | string;
  price_max: number | string;
  typical_price: number | string;
  area_count: number;
  source_url: string | null;
};

// Dates are calendar days (YYYY-MM-DD), so format them as UTC noon: the same day in any time zone.
const monthDay = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const day = (isoDate: string) => new Date(`${isoDate}T12:00:00Z`);

/** "Oct 20–26", or "Oct 27 – Nov 2" across months. */
export function formatWeek(start: string, end: string): string {
  return start.slice(0, 7) === end.slice(0, 7)
    ? `${monthDay.format(day(start))}–${Number(end.slice(8, 10))}`
    : `${monthDay.format(day(start))} – ${monthDay.format(day(end))}`;
}

/** "₱75.10–₱92.30", or one price when the range is a single value. */
export function formatRange(min: number | string, max: number | string): string {
  const lo = Number(min);
  const hi = Number(max);
  return lo === hi ? formatPrice(lo) : `${formatPrice(lo)}–${formatPrice(hi)}`;
}

/** The row for one fuel, if the DOE monitored it in that region this week. */
export function priceFor(rows: DoePrice[], fuel: string): DoePrice | undefined {
  return rows.find((r) => r.fuel_type === fuel);
}

/** Identifies one region's week, for remembering that the user dismissed it. */
export function weekKey(rows: DoePrice[]): string | null {
  const r = rows[0];
  return r ? `${r.region}:${r.week_start}` : null;
}

/**
 * The map centre rounded to about 5 km, so panning a little doesn't refetch. The region is
 * found from the nearest station within 30 km, so this precision is plenty.
 */
export function roundCenter(lat: number, lng: number): { lat: number; lng: number } {
  return { lat: Math.round(lat * 20) / 20, lng: Math.round(lng * 20) / 20 };
}
