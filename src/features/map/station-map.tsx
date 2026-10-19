import { Camera, Map, ViewAnnotation, type CameraRef } from '@maplibre/maplibre-react-native';
import { useImperativeHandle, useRef } from 'react';

import { PricePin, UserDot } from './price-pin';
import { DEFAULT_ZOOM, MAP_STYLE, type StationMapProps } from './types';

// Phone version (MapLibre Native, needs a development build). The web version is station-map.web.tsx.
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
  const cameraRef = useRef<CameraRef>(null);

  useImperativeHandle(ref, () => ({
    flyTo: (target, zoom) =>
      cameraRef.current?.flyTo({
        center: [target.longitude, target.latitude],
        ...(zoom != null ? { zoom } : {}),
        duration: 700,
      }),
  }));

  return (
    <Map
      style={{ flex: 1 }}
      mapStyle={MAP_STYLE}
      logo={false}
      attribution
      onRegionDidChange={(e) => {
        const [longitude, latitude] = e.nativeEvent.center;
        onMoveEnd({ latitude, longitude }, e.nativeEvent.userInteraction);
      }}>
      <Camera
        ref={cameraRef}
        initialViewState={{
          center: [initialCenter.longitude, initialCenter.latitude],
          zoom: DEFAULT_ZOOM,
        }}
      />
      {stations.map((station) => (
        <ViewAnnotation
          key={station.id}
          id={station.id}
          lngLat={[station.longitude, station.latitude]}
          anchor="bottom"
          onPress={() => onSelect(station.id)}>
          <PricePin station={station} fuel={fuel} selected={station.id === selectedId} />
        </ViewAnnotation>
      ))}
      {userLocation ? (
        <ViewAnnotation id="me" lngLat={[userLocation.longitude, userLocation.latitude]}>
          <UserDot />
        </ViewAnnotation>
      ) : null}
    </Map>
  );
}
