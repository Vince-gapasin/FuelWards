import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '@/components/logo';
import { Notice } from '@/components/notice';
import { useProfile } from '@/features/auth/use-profile';
import { useUserLocation } from '@/features/location/use-location';
import { StationMap } from '@/features/map/station-map';
import { FOCUS_ZOOM, type StationMapHandle } from '@/features/map/types';
import { sortStations } from '@/features/stations/format';
import { FuelChips } from '@/features/stations/fuel-chips';
import { SearchBar } from '@/features/stations/search-bar';
import { StationCard } from '@/features/stations/station-card';
import type { LatLng, SortMode, Station } from '@/features/stations/types';
import { useFuelTypes, useNearbyStations } from '@/features/stations/use-stations';

// Santa Mesa, Manila: where the prototype's map is centred. Used until the user shares a location.
const DEFAULT_CENTER: LatLng = { latitude: 14.6008, longitude: 121.0067 };
const CARD_GAP = 12;

// Figma: "Home Page" (35:150) and the five station pages, now one data-driven screen.
export default function Home() {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 64, 340);

  const mapRef = useRef<StationMapHandle>(null);
  const listRef = useRef<FlatList<Station>>(null);
  const { location, status: locationStatus, locate } = useUserLocation();

  const [queryCenter, setQueryCenter] = useState<LatLng>(DEFAULT_CENTER);
  const [fuel, setFuel] = useState('GAS91');
  const [sort, setSort] = useState<SortMode>('nearest');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Set when a pin or search result picks a station, so the carousel scrolls to it.
  const scrollToSelection = useRef(false);

  const profile = useProfile();
  const fuelTypes = useFuelTypes();
  const nearby = useNearbyStations(queryCenter);
  const stations = useMemo(
    () => sortStations(nearby.data ?? [], sort, fuel),
    [nearby.data, sort, fuel],
  );

  // Once the first location fix arrives, show the stations around the user.
  const centredOnUser = useRef(false);
  useEffect(() => {
    if (location && !centredOnUser.current) {
      centredOnUser.current = true;
      setQueryCenter(location);
      mapRef.current?.flyTo(location);
    }
  }, [location]);

  useEffect(() => {
    if (!scrollToSelection.current || !selectedId) return;
    const index = stations.findIndex((s) => s.id === selectedId);
    if (index < 0) return;
    scrollToSelection.current = false;
    listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
  }, [selectedId, stations]);

  const focusStation = (station: Station, zoom?: number) => {
    setSelectedId(station.id);
    mapRef.current?.flyTo(station, zoom);
  };

  const onCarouselSettled = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / (cardWidth + CARD_GAP));
    const station = stations[Math.min(Math.max(index, 0), stations.length - 1)];
    if (station && station.id !== selectedId) focusStation(station);
  };

  const onLocate = async () => {
    const here = await locate();
    if (here) {
      setQueryCenter(here);
      mapRef.current?.flyTo(here, FOCUS_ZOOM);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView edges={['top']} className="z-20 bg-white">
        <View className="flex-row items-center justify-between border-b border-line px-3 py-1.5">
          <View className="flex-row items-center gap-1.5">
            <Logo size={34} />
            <Text className="font-logo text-xl text-ink">
              Fuel <Text className="text-brand">Rewards</Text>
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${profile.data?.points ?? 0} points. Open rewards`}
              onPress={() => router.push('/rewards')}
              className="flex-row items-center gap-1.5 rounded-full border border-line px-3 py-1.5 active:bg-sky">
              <Ionicons name="star" size={15} color="#FFDF00" />
              <Text className="font-semibold text-sm text-ink">{profile.data?.points ?? 0}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Account"
              onPress={() => router.push('/account')}
              className="h-9 w-9 items-center justify-center rounded-full active:bg-sky">
              <Ionicons name="person-circle-outline" size={28} color="#011D39" />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      <View className="flex-1">
        <View className="absolute inset-0">
          <StationMap
            ref={mapRef}
            stations={stations}
            fuel={fuel}
            selectedId={selectedId}
            initialCenter={DEFAULT_CENTER}
            userLocation={location}
            onSelect={(id) => {
              scrollToSelection.current = true;
              const station = stations.find((s) => s.id === id);
              if (station) focusStation(station);
            }}
            onMoveEnd={(center, byUser) => {
              if (byUser) setQueryCenter(center);
            }}
          />
        </View>

        <View className="z-10 gap-2 pt-3" pointerEvents="box-none">
          <SearchBar
            near={location ?? queryCenter}
            onPick={(station) => {
              scrollToSelection.current = true;
              setQueryCenter(station);
              focusStation(station, FOCUS_ZOOM);
            }}
          />
          <FuelChips
            fuelTypes={fuelTypes.data ?? []}
            selected={fuel}
            onSelect={setFuel}
            sort={sort}
            onToggleSort={() => setSort((s) => (s === 'nearest' ? 'cheapest' : 'nearest'))}
          />
          {locationStatus === 'denied' ? (
            <View className="mx-3">
              <Notice
                tone="info"
                message="Location is off, so you're seeing Santa Mesa. Allow location in your settings to see stations near you."
              />
            </View>
          ) : null}
          {nearby.isError ? (
            <View className="mx-3">
              <Notice tone="error" message="Couldn't load stations. Check your connection." />
            </View>
          ) : null}
        </View>

        <View className="absolute bottom-0 left-0 right-0 gap-3 pb-4" pointerEvents="box-none">
          <View className="flex-row items-center justify-end gap-2 px-3" pointerEvents="box-none">
            {nearby.isFetching ? (
              <View className="rounded-full bg-white px-3 py-1.5 shadow-sm">
                <ActivityIndicator size="small" color="#007BFF" />
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show my location"
              onPress={onLocate}
              className="h-12 w-12 items-center justify-center rounded-full border border-line bg-white shadow-md active:bg-sky">
              {locationStatus === 'locating' ? (
                <ActivityIndicator color="#00BF63" />
              ) : (
                <Ionicons name="locate" size={22} color="#00BF63" />
              )}
            </Pressable>
          </View>

          {nearby.isSuccess && stations.length === 0 ? (
            <View className="mx-3 rounded-2xl bg-white p-4 shadow-md">
              <Text className="text-sm text-ink">
                No stations within 5 km. Move the map to look in another area.
              </Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={stations}
              keyExtractor={(s) => s.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={cardWidth + CARD_GAP}
              decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: (width - cardWidth) / 2, gap: CARD_GAP }}
              getItemLayout={(_, index) => ({
                length: cardWidth + CARD_GAP,
                offset: (cardWidth + CARD_GAP) * index,
                index,
              })}
              onMomentumScrollEnd={onCarouselSettled}
              renderItem={({ item }) => (
                <StationCard
                  station={item}
                  fuelTypes={fuelTypes.data ?? []}
                  selectedFuel={fuel}
                  selected={item.id === selectedId}
                  width={cardWidth}
                  onPress={() => focusStation(item, FOCUS_ZOOM)}
                />
              )}
            />
          )}
        </View>
      </View>
    </View>
  );
}
