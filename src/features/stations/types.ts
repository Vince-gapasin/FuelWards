export type LatLng = { latitude: number; longitude: number };

export type StationPrice = { price: number; reported_at: string };

/** A row from the nearby_stations / search_stations RPCs. */
export type Station = {
  id: string;
  name: string;
  brand: string | null;
  brand_color: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  distance_m: number;
  /** Latest verified price per fuel code, e.g. { DIESEL: { price: 58.5, reported_at } }. */
  prices: Record<string, StationPrice>;
};

export type FuelType = { code: string; label: string; short_label: string; sort: number };

export type SortMode = 'nearest' | 'cheapest';
