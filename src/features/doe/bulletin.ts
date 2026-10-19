import i18n from '@/i18n';

export type BulletinRow = {
  effective_date: string;
  fuel_type: string;
  change_min: number;
  change_max: number;
  source_url: string | null;
};

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}₱${Math.abs(n).toFixed(2)}`;

/** "+₱1.10 to +₱1.30", "−₱0.40 to −₱0.20", or a single value when the range is one number. */
export function formatChange(min: number, max: number): string {
  return min === max ? signed(min) : i18n.t('doe.range', { from: signed(min), to: signed(max) });
}

const dayFormat = new Intl.DateTimeFormat('en-PH', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

/** "Tue, Oct 21" for a YYYY-MM-DD date. */
export function formatEffectiveDate(isoDate: string): string {
  return dayFormat.format(new Date(`${isoDate}T00:00:00+08:00`));
}

/** Whether the bulletin is a hike, a rollback or mixed, for the banner's colour. */
export function bulletinTone(
  rows: Pick<BulletinRow, 'change_min' | 'change_max'>[],
): 'hike' | 'rollback' | 'mixed' {
  const up = rows.some((r) => r.change_max > 0);
  const down = rows.some((r) => r.change_min < 0);
  return up && !down ? 'hike' : down && !up ? 'rollback' : 'mixed';
}
