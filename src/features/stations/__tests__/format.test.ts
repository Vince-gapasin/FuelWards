import {
  brandCode,
  directionsUrl,
  formatAge,
  formatDistance,
  formatPinPrice,
  formatPrice,
  sortStations,
} from '@/features/stations/format';
import type { Station } from '@/features/stations/types';

const station = (id: string, distance_m: number, prices: Record<string, number> = {}): Station => ({
  id,
  name: id,
  brand: null,
  brand_color: null,
  address: null,
  latitude: 14.6,
  longitude: 121,
  distance_m,
  prices: Object.fromEntries(
    Object.entries(prices).map(([fuel, price]) => [
      fuel,
      { price, reported_at: '2026-10-19T00:00:00Z' },
    ]),
  ),
});

describe('formatting', () => {
  it('formats peso prices', () => {
    expect(formatPrice(62.1)).toBe('₱62.10');
    expect(formatPrice(undefined)).toBe('—');
    expect(formatPinPrice(61.6)).toBe('₱62');
  });

  it('formats distances', () => {
    expect(formatDistance(4)).toBe('10 m');
    expect(formatDistance(846)).toBe('850 m');
    expect(formatDistance(1234)).toBe('1.2 km');
    expect(formatDistance(12_600)).toBe('13 km');
  });

  it('builds three-letter brand codes like the prototype pins', () => {
    expect(brandCode('Petron')).toBe('PET');
    expect(brandCode('Flying V')).toBe('FLY');
    expect(brandCode(null)).toBe('GAS');
  });

  it('describes how old a price is', () => {
    const now = new Date('2026-10-19T12:00:00Z');
    expect(formatAge('2026-10-19T11:59:40Z', now)).toBe('just now');
    expect(formatAge('2026-10-19T11:15:00Z', now)).toBe('45 min ago');
    expect(formatAge('2026-10-19T09:00:00Z', now)).toBe('3 h ago');
    expect(formatAge('2026-10-18T10:00:00Z', now)).toBe('1 day ago');
  });

  it('links to Google Maps directions', () => {
    expect(directionsUrl({ latitude: 14.6, longitude: 121.01 })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=14.6,121.01',
    );
  });
});

describe('sortStations', () => {
  const list = [
    station('far-cheap', 3000, { DIESEL: 55 }),
    station('near-no-price', 100),
    station('mid-pricey', 900, { DIESEL: 60 }),
    station('near-cheap', 500, { DIESEL: 55 }),
  ];

  it('sorts by distance', () => {
    expect(sortStations(list, 'nearest', 'DIESEL').map((s) => s.id)).toEqual([
      'near-no-price',
      'near-cheap',
      'mid-pricey',
      'far-cheap',
    ]);
  });

  it('sorts by price for the chosen fuel, nearest first on ties, unpriced last', () => {
    expect(sortStations(list, 'cheapest', 'DIESEL').map((s) => s.id)).toEqual([
      'near-cheap',
      'far-cheap',
      'mid-pricey',
      'near-no-price',
    ]);
  });

  it('does not change the input list', () => {
    const copy = [...list];
    sortStations(list, 'cheapest', 'DIESEL');
    expect(list).toEqual(copy);
  });
});
