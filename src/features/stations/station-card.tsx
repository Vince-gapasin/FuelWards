import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Linking, Pressable, Text, View } from 'react-native';

import { directionsUrl, formatAge, formatDistance, formatPrice } from './format';
import type { FuelType, Station } from './types';

type Props = {
  station: Station;
  fuelTypes: FuelType[];
  selectedFuel: string;
  selected: boolean;
  width: number;
  onPress: () => void;
};

// Fuels shown on the card, as in the prototype; the selected fuel is added if it isn't one of them.
const CARD_FUELS = ['GAS91', 'GAS95', 'DIESEL'];

/** Station card from the prototype carousel ("Unioil · Magsaysay Blvd · 0.6 km"). */
export function StationCard({ station, fuelTypes, selectedFuel, selected, width, onPress }: Props) {
  const codes = CARD_FUELS.includes(selectedFuel)
    ? CARD_FUELS
    : [...CARD_FUELS.slice(0, 2), selectedFuel];
  const label = (code: string) => fuelTypes.find((f) => f.code === code)?.short_label ?? code;
  const newest = Object.values(station.prices)
    .map((p) => p.reported_at)
    .sort()
    .at(-1);

  return (
    <View
      style={{ width }}
      className={`gap-2.5 rounded-2xl border bg-white p-3.5 ${selected ? 'border-action' : 'border-line'}`}>
      {/* Only the details are one button; the actions below are separate buttons, not nested. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${station.name}, ${formatDistance(station.distance_m)} away`}
        aria-selected={selected}
        onPress={onPress}
        className="gap-2.5">
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1">
            <Text numberOfLines={1} className="font-bold text-lg text-ink">
              {station.name}
            </Text>
            <Text numberOfLines={1} className="text-xs text-ink-muted">
              {[station.address, formatDistance(station.distance_m)].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <View
            className={`rounded-full px-2 py-0.5 ${newest ? 'bg-brand/15' : 'bg-line/60'}`}
            accessibilityLabel={newest ? `Prices updated ${formatAge(newest)}` : 'No prices yet'}>
            <Text
              className={`font-semibold text-[10px] ${newest ? 'text-brand' : 'text-ink-muted'}`}>
              {newest ? `Updated ${formatAge(newest)}` : 'No prices yet'}
            </Text>
          </View>
        </View>

        <View className="flex-row rounded-xl bg-sky/60 py-2">
          {codes.map((code, i) => (
            <View
              key={code}
              className={`flex-1 items-center ${i > 0 ? 'border-l border-line' : ''}`}>
              <Text
                className={`text-[10px] ${code === selectedFuel ? 'font-bold text-action' : 'text-ink-muted'}`}>
                {label(code)}
              </Text>
              <Text className="font-bold text-sm text-ink">
                {formatPrice(station.prices[code]?.price)}
              </Text>
            </View>
          ))}
        </View>
      </Pressable>

      {station.pending_count > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/report/${station.id}`)}
          className="flex-row items-center gap-1.5 self-start rounded-full bg-star/30 px-2.5 py-1 active:bg-star/50">
          <Ionicons name="help-circle" size={13} color="#011D39" />
          <Text className="font-semibold text-[11px] text-navy">
            {station.pending_count === 1
              ? '1 price to confirm'
              : `${station.pending_count} prices to confirm`}
          </Text>
        </Pressable>
      ) : null}

      <View className="flex-row gap-2">
        <Pressable
          accessibilityRole="link"
          onPress={() => Linking.openURL(directionsUrl(station))}
          className="h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-lg bg-navy active:bg-navy-600">
          <Ionicons name="navigate" size={14} color="#FFFFFF" />
          <Text className="font-semibold text-sm text-white">Directions</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/report/${station.id}`)}
          className="h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-white active:bg-sky">
          <Ionicons name="add" size={16} color="#011D39" />
          <Text className="font-semibold text-sm text-navy">Update price</Text>
        </Pressable>
      </View>
    </View>
  );
}
