import { Text, View } from 'react-native';

import { brandCode, formatPinPrice, priceFor } from '@/features/stations/format';
import type { Station } from '@/features/stations/types';

type Props = { station: Station; fuel: string; selected: boolean };

/** Map pin from the prototype: brand code over the price, in the brand's colour. */
export function PricePin({ station, fuel, selected }: Props) {
  const price = priceFor(station, fuel);
  const color = station.brand_color ?? '#011D39';
  return (
    <View
      accessibilityLabel={`${station.name}, ${price == null ? 'no price yet' : formatPinPrice(price)}`}
      className="items-center"
      style={{ transform: [{ scale: selected ? 1.15 : 1 }] }}>
      <View
        className={`min-w-[44px] items-center rounded-full px-2 py-1 ${selected ? 'border-2 border-white' : ''}`}
        style={{
          backgroundColor: price == null ? '#5A5A5A' : color,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 1 },
          elevation: 3,
        }}>
        <Text className="font-semibold text-[9px] leading-[10px] text-white/90">
          {brandCode(station.brand)}
        </Text>
        <Text className="font-bold text-xs leading-[14px] text-white">{formatPinPrice(price)}</Text>
      </View>
      <View
        className="-mt-px h-0 w-0 border-x-[5px] border-t-[6px] border-x-transparent"
        style={{ borderTopColor: price == null ? '#5A5A5A' : color }}
      />
    </View>
  );
}

/** Blue dot for the user's position. */
export function UserDot() {
  return (
    <View
      accessibilityLabel="Your location"
      className="h-[18px] w-[18px] items-center justify-center rounded-full bg-action/25">
      <View className="h-3 w-3 rounded-full border-2 border-white bg-action" />
    </View>
  );
}
