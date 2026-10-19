import type { Ref } from 'react';

import type { LatLng, Station } from '@/features/stations/types';

/** Free vector tiles, no API key. © OpenMapTiles, data © OpenStreetMap contributors. */
export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
export const DEFAULT_ZOOM = 14;
export const FOCUS_ZOOM = 15.5;

export type StationMapHandle = {
  flyTo: (target: LatLng, zoom?: number) => void;
};

export type StationMapProps = {
  stations: Station[];
  /** Fuel code whose price each pin shows. */
  fuel: string;
  selectedId: string | null;
  initialCenter: LatLng;
  userLocation: LatLng | null;
  onSelect: (stationId: string) => void;
  /**
   * Called when the map stops moving. `byUser` is false for moves the app started (flyTo), so
   * the station list only refreshes when the user pans, not while a card swipe re-centres it.
   */
  onMoveEnd: (center: LatLng, byUser: boolean) => void;
  ref?: Ref<StationMapHandle>;
};
