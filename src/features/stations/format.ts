import type { SortMode, Station } from './types';
import i18n from '@/i18n';

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** ₱62.10 */
export function formatPrice(price: number | undefined | null): string {
  return price == null ? '—' : peso.format(price);
}

/** Short pin label: ₱62 (whole pesos keep pins narrow). */
export function formatPinPrice(price: number | undefined | null): string {
  return price == null ? '—' : `₱${Math.round(price)}`;
}

/** 850 m · 1.2 km */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}

/** Three-letter code shown on map pins, as in the prototype (PET, SHE, UNI…). */
export function brandCode(brand: string | null): string {
  if (!brand) return 'GAS';
  return brand
    .replace(/[^A-Za-z]/g, '')
    .slice(0, 3)
    .toUpperCase();
}

/** "Updated 3 h ago" style freshness for a price timestamp. */
export function formatAge(iso: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return i18n.t('age.justNow');
  if (minutes < 60) return i18n.t('age.minutes', { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return i18n.t('age.hours', { count: hours });
  return i18n.t('age.days', { count: Math.round(hours / 24) });
}

export function priceFor(station: Station, fuel: string): number | undefined {
  return station.prices[fuel]?.price;
}

/**
 * Nearest: by distance. Cheapest: stations with a price for the chosen fuel first (lowest first),
 * then the rest by distance, so stations without data never hide priced ones.
 */
export function sortStations(stations: Station[], mode: SortMode, fuel: string): Station[] {
  const byDistance = (a: Station, b: Station) => a.distance_m - b.distance_m;
  if (mode === 'nearest') return [...stations].sort(byDistance);
  return [...stations].sort((a, b) => {
    const pa = priceFor(a, fuel);
    const pb = priceFor(b, fuel);
    if (pa != null && pb != null) return pa - pb || byDistance(a, b);
    if (pa != null) return -1;
    if (pb != null) return 1;
    return byDistance(a, b);
  });
}

/** Google Maps directions; opens the app on phones and the website on desktop. */
export function directionsUrl(station: Pick<Station, 'latitude' | 'longitude'>): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`;
}

/** Waze navigation; opens the Waze app when installed, otherwise its website. */
export function wazeUrl(station: Pick<Station, 'latitude' | 'longitude'>): string {
  return `https://waze.com/ul?ll=${station.latitude},${station.longitude}&navigate=yes`;
}
