import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, Text } from 'react-native';

import type { FuelType, SortMode } from './types';

type Props = {
  fuelTypes: FuelType[];
  selected: string;
  onSelect: (code: string) => void;
  sort: SortMode;
  onToggleSort: () => void;
};

/** Fuel filter chips plus the Nearest / Cheapest sort toggle. */
export function FuelChips({ fuelTypes, selected, onSelect, sort, onToggleSort }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-3 py-1">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Sort by ${sort === 'nearest' ? 'nearest' : 'cheapest'}. Tap to change.`}
        onPress={onToggleSort}
        className="h-8 flex-row items-center gap-1 rounded-full bg-navy px-3 active:bg-navy-600">
        <Ionicons
          name={sort === 'nearest' ? 'navigate-outline' : 'pricetag-outline'}
          size={13}
          color="#FFFFFF"
        />
        <Text className="font-semibold text-xs text-white">
          {sort === 'nearest' ? 'Nearest' : 'Cheapest'}
        </Text>
      </Pressable>
      {fuelTypes.map((fuel) => {
        const active = fuel.code === selected;
        return (
          <Pressable
            key={fuel.code}
            accessibilityRole="radio"
            aria-checked={active}
            accessibilityLabel={fuel.label}
            onPress={() => onSelect(fuel.code)}
            className={`h-8 justify-center rounded-full border px-3 ${
              active ? 'border-action bg-action' : 'border-line bg-white active:bg-sky'
            }`}>
            <Text className={`font-semibold text-xs ${active ? 'text-white' : 'text-ink'}`}>
              {fuel.short_label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
