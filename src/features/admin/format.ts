// Pure helpers for the admin console (unit-tested).

const manilaDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' });

/**
 * The Tuesday the next DOE price adjustment takes effect, as YYYY-MM-DD (Manila time). Oil
 * companies announce on Monday and adjust on Tuesday, so on a Tuesday this is today.
 */
export function nextAdjustmentDate(now: Date = new Date()): string {
  const today = new Date(`${manilaDate.format(now)}T00:00:00Z`);
  const daysAhead = (2 - today.getUTCDay() + 7) % 7;
  today.setUTCDate(today.getUTCDate() + daysAhead);
  return today.toISOString().slice(0, 10);
}

export function isIsoDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const d = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text;
}

/** "1.10", "+1.10", "-0.5" or "−0.50" (typographic minus) → number. Blank → null. */
export function parseChange(text: string): number | null | 'invalid' {
  const cleaned = text.trim().replace(/^−/, '-').replace(/^\+/, '').replace(/₱/g, '');
  if (cleaned === '') return null;
  if (!/^-?\d{1,2}(\.\d{1,2})?$/.test(cleaned)) return 'invalid';
  return Number(cleaned);
}

export type BulletinDraft = { fuel_type: string; min: string; max: string };

export type BulletinRowInput = {
  effective_date: string;
  fuel_type: string;
  change_min: number;
  change_max: number;
  source_url: string | null;
};

/**
 * Turns the bulletin form into rows to save. A fuel with both fields blank is skipped. A fuel with
 * only one field filled uses it for both ends of the range.
 */
export function bulletinRows(
  date: string,
  drafts: BulletinDraft[],
  sourceUrl: string,
): { rows: BulletinRowInput[]; error: string | null } {
  if (!isIsoDate(date)) return { rows: [], error: 'Enter the date as YYYY-MM-DD.' };
  const url = sourceUrl.trim();
  if (url && !/^https?:\/\/\S+$/.test(url)) {
    return { rows: [], error: 'The source link must start with http:// or https://.' };
  }
  const rows: BulletinRowInput[] = [];
  for (const draft of drafts) {
    const min = parseChange(draft.min);
    const max = parseChange(draft.max);
    if (min === 'invalid' || max === 'invalid') {
      return { rows: [], error: `${draft.fuel_type}: enter peso amounts like 1.10 or -0.50.` };
    }
    if (min === null && max === null) continue;
    const low = min ?? max!;
    const high = max ?? min!;
    if (low > high)
      return { rows: [], error: `${draft.fuel_type}: the lowest change is above the highest.` };
    rows.push({
      effective_date: date,
      fuel_type: draft.fuel_type,
      change_min: low,
      change_max: high,
      source_url: url || null,
    });
  }
  if (rows.length === 0) return { rows: [], error: 'Enter a change for at least one fuel.' };
  return { rows, error: null };
}

/** One line describing an audit-log entry, e.g. "banned a user" or "updated stations". */
export function describeAction(action: string, table: string | null): string {
  switch (action) {
    case 'decide_report':
      return 'decided a price';
    case 'ban':
      return 'banned a user';
    case 'unban':
      return 'lifted a ban';
    case 'insert':
      return `added to ${table ?? 'a table'}`;
    case 'update':
      return `updated ${table ?? 'a table'}`;
    case 'delete':
      return `deleted from ${table ?? 'a table'}`;
    default:
      return action;
  }
}
