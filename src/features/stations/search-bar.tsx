import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { formatDistance } from './format';
import type { LatLng, Station } from './types';
import { useStationSearch } from './use-stations';

type Props = {
  near: LatLng | null;
  onPick: (station: Station) => void;
};

/** Search by station name, brand, street or city; results drop down under the field. */
export function SearchBar({ near, onPick }: Props) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const search = useStationSearch(query, near);
  const open = focused && query.trim().length >= 2;

  return (
    <View className="mx-3">
      <View className="h-11 flex-row items-center gap-2 rounded-full border border-line bg-white px-4 shadow-sm">
        <Ionicons name="search" size={18} color="#5A5A5A" />
        <TextInput
          accessibilityLabel="Search stations"
          placeholder="Search station, brand or street"
          placeholderTextColor="#8A8A8A"
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          // Delay so a tap on a result registers before the list closes.
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          returnKeyType="search"
          autoCorrect={false}
          className="h-full flex-1 font-sans text-sm text-ink outline-none"
        />
        {search.isFetching ? <ActivityIndicator size="small" color="#007BFF" /> : null}
        {query ? (
          <Pressable accessibilityLabel="Clear search" hitSlop={8} onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color="#8A8A8A" />
          </Pressable>
        ) : null}
      </View>

      {open ? (
        <View className="mt-1.5 max-h-72 overflow-hidden rounded-2xl border border-line bg-white shadow-md">
          {search.data?.length ? (
            search.data.map((station) => (
              <Pressable
                key={station.id}
                accessibilityRole="button"
                onPress={() => {
                  onPick(station);
                  setQuery('');
                  setFocused(false);
                }}
                className="flex-row items-center gap-3 border-b border-line/60 px-4 py-2.5 active:bg-sky">
                <Ionicons name="location-outline" size={18} color="#011D39" />
                <View className="flex-1">
                  <Text numberOfLines={1} className="font-semibold text-sm text-ink">
                    {station.name}
                  </Text>
                  <Text numberOfLines={1} className="text-xs text-ink-muted">
                    {[station.address, formatDistance(station.distance_m)]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
              </Pressable>
            ))
          ) : (
            <Text className="px-4 py-3 text-sm text-ink-muted">
              {search.isFetching || search.isPending
                ? 'Searching…'
                : search.isError
                  ? 'Search failed. Check your connection.'
                  : 'No stations match.'}
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}
