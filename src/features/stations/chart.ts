export type PricePoint = { day: string; price: number };

export type ChartGeometry = {
  /** SVG path for the line. Empty when there's nothing to draw. */
  path: string;
  dots: { x: number; y: number; price: number; day: string }[];
  min: number;
  max: number;
};

/**
 * Scales daily prices into an SVG box. x follows the calendar (gaps stay gaps); y gets a little
 * headroom so a flat line sits mid-chart instead of on the edge.
 */
export function buildChart(
  points: PricePoint[],
  width: number,
  height: number,
  pad = { top: 12, right: 12, bottom: 12, left: 12 },
): ChartGeometry {
  const sorted = [...points].sort((a, b) => a.day.localeCompare(b.day));
  if (!sorted.length) return { path: '', dots: [], min: 0, max: 0 };

  const prices = sorted.map((p) => p.price);
  let min = Math.min(...prices);
  let max = Math.max(...prices);
  if (max - min < 1) {
    min -= 0.5;
    max += 0.5;
  }

  const times = sorted.map((p) => Date.parse(`${p.day}T00:00:00Z`));
  const first = times[0];
  const span = Math.max(times[times.length - 1] - first, 1);
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const dots = sorted.map((p, i) => ({
    x:
      sorted.length === 1 ? pad.left + innerW / 2 : pad.left + ((times[i] - first) / span) * innerW,
    y: pad.top + (1 - (p.price - min) / (max - min)) * innerH,
    price: p.price,
    day: p.day,
  }));
  const path = dots
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${d.x.toFixed(1)},${d.y.toFixed(1)}`)
    .join(' ');
  return { path, dots, min, max };
}
