import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

import type { LatLng } from '@/features/stations/types';

export type LocationStatus = 'idle' | 'locating' | 'granted' | 'denied' | 'unavailable';

/**
 * The user's position. Never prompts on its own: it only reads the position on launch if
 * permission was already given, and asks when the user taps "locate me".
 */
export function useUserLocation() {
  const [location, setLocation] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<LocationStatus>('idle');

  const read = useCallback(async (): Promise<LatLng | null> => {
    setStatus('locating');
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const here = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setLocation(here);
      setStatus('granted');
      return here;
    } catch {
      setStatus('unavailable');
      return null;
    }
  }, []);

  /** Asks for permission if needed, then returns the current position (or null). */
  const locate = useCallback(async (): Promise<LatLng | null> => {
    const { status: permission } = await Location.requestForegroundPermissionsAsync();
    if (permission !== 'granted') {
      setStatus('denied');
      return null;
    }
    return read();
  }, [read]);

  useEffect(() => {
    Location.getForegroundPermissionsAsync()
      .then(({ status: permission }) => {
        if (permission === 'granted') read();
      })
      .catch(() => setStatus('unavailable'));
  }, [read]);

  return { location, status, locate };
}
