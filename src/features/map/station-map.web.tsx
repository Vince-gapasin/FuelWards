import 'maplibre-gl/dist/maplibre-gl.css';

import { setWorkerUrl } from 'maplibre-gl';
import { useImperativeHandle, useRef } from 'react';
import { Map, Marker, type MapRef } from 'react-map-gl/maplibre';

import { PricePin, UserDot } from './price-pin';
import { DEFAULT_ZOOM, MAP_STYLE, type StationMapProps } from './types';

// Copied into public/ by scripts/copy-maplibre-worker.mjs; Metro can't bundle the worker itself.
setWorkerUrl('/maplibre-gl-worker.mjs');

// Web version (maplibre-gl). The phone version is station-map.tsx.
export function StationMap({
  stations,
  fuel,
  selectedId,
  initialCenter,
  userLocation,
  onSelect,
  onMoveEnd,
  ref,
}: StationMapProps) {
  const mapRef = useRef<MapRef>(null);

  useImperativeHandle(ref, () => ({
    flyTo: (target, zoom) =>
      mapRef.current?.flyTo({
        center: [target.longitude, target.latitude],
        zoom: zoom ?? mapRef.current.getZoom(),
        duration: 700,
      }),
  }));

  return (
    <Map
      ref={mapRef}
      initialViewState={{
        latitude: initialCenter.latitude,
        longitude: initialCenter.longitude,
        zoom: DEFAULT_ZOOM,
      }}
      mapStyle={MAP_STYLE}
      style={{ width: '100%', height: '100%' }}
      attributionControl={{ compact: true }}
      onMoveEnd={(e) =>
        onMoveEnd(
          { latitude: e.viewState.latitude, longitude: e.viewState.longitude },
          // maplibre only attaches the browser event to moves the user made.
          Boolean(e.originalEvent),
        )
      }>
      {stations.map((station) => (
        <Marker
          key={station.id}
          latitude={station.latitude}
          longitude={station.longitude}
          anchor="bottom"
          style={{ zIndex: station.id === selectedId ? 2 : 1, cursor: 'pointer' }}
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            onSelect(station.id);
          }}>
          <PricePin station={station} fuel={fuel} selected={station.id === selectedId} />
        </Marker>
      ))}
      {userLocation ? (
        <Marker
          latitude={userLocation.latitude}
          longitude={userLocation.longitude}
          anchor="center"
          style={{ zIndex: 3 }}>
          <UserDot />
        </Marker>
      ) : null}
    </Map>
  );
}
