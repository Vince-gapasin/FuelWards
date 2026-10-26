import { applyLivePrice, applyLivePriceToStation, type LivePrice } from '@/features/stations/live';
import type { StationPrice } from '@/features/stations/types';

const station = (id: string, prices: Record<string, StationPrice> = {}) => ({ id, prices });

const live: LivePrice = {
  station_id: 'a',
  fuel_type: 'DIESEL',
  price: '57.40',
  reported_at: '2026-10-27T03:00:00Z',
  verified_at: '2026-10-27T03:20:00Z',
};

describe('applyLivePriceToStation', () => {
  it('adds or replaces the fuel price with a number', () => {
    const before = station('a', { DIESEL: { price: 58, reported_at: '2026-10-26T03:00:00Z' } });
    expect(applyLivePriceToStation(before, live).prices.DIESEL).toEqual({
      price: 57.4,
      reported_at: '2026-10-27T03:00:00Z',
    });
  });

  it('keeps other fuels', () => {
    const before = station('a', { GAS91: { price: 61, reported_at: '2026-10-26T03:00:00Z' } });
    expect(applyLivePriceToStation(before, live).prices.GAS91.price).toBe(61);
  });

  it('ignores an older report confirmed late', () => {
    const before = station('a', { DIESEL: { price: 58, reported_at: '2026-10-27T05:00:00Z' } });
    expect(applyLivePriceToStation(before, live)).toBe(before);
  });

  it('ignores other stations', () => {
    const other = station('b');
    expect(applyLivePriceToStation(other, live)).toBe(other);
  });
});

describe('applyLivePrice', () => {
  it('returns the same list when nothing changes, so the map does not re-render', () => {
    const list = [station('b'), station('c')];
    expect(applyLivePrice(list, live)).toBe(list);
  });

  it('updates only the matching station', () => {
    const list = [station('a'), station('b')];
    const next = applyLivePrice(list, live)!;
    expect(next).not.toBe(list);
    expect(next[0].prices.DIESEL.price).toBe(57.4);
    expect(next[1]).toBe(list[1]);
  });

  it('handles an empty cache', () => {
    expect(applyLivePrice(undefined, live)).toBeUndefined();
  });
});
