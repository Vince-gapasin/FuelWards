import type { StationPrice } from './types';

/** A price that was just verified, as broadcast by the database (price_broadcast_payload). */
export type LivePrice = {
  station_id: string;
  fuel_type: string;
  price: number | string;
  reported_at: string;
  verified_at: string | null;
};

type WithPrices = { id: string; prices: Record<string, StationPrice> };

/**
 * The station with the live price applied, or the same object when nothing changes: another
 * station, or a price older than the one already shown (an old report confirmed late).
 */
export function applyLivePriceToStation<T extends WithPrices>(station: T, live: LivePrice): T {
  if (station.id !== live.station_id) return station;
  const current = station.prices[live.fuel_type];
  if (current && Date.parse(current.reported_at) > Date.parse(live.reported_at)) return station;
  return {
    ...station,
    prices: {
      ...station.prices,
      [live.fuel_type]: { price: Number(live.price), reported_at: live.reported_at },
    },
  };
}

/** Applies a live price to a cached list. Returns the same array when no station changed. */
export function applyLivePrice<T extends WithPrices>(
  stations: T[] | undefined,
  live: LivePrice,
): T[] | undefined {
  if (!stations) return stations;
  let changed = false;
  const next = stations.map((s) => {
    const updated = applyLivePriceToStation(s, live);
    if (updated !== s) changed = true;
    return updated;
  });
  return changed ? next : stations;
}
