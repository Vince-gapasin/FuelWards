import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { FuelType, LatLng } from '@/features/stations/types';
import { formatPrice } from '@/features/stations/format';

import { useDoePricesForStation, useDoePricesNear } from './api';
import { formatRange, formatWeek, priceFor, weekKey, type DoePrice } from './prices';

const DISMISSED_KEY = 'fw.doePricesDismissed';

/** Station page: the DOE's latest weekly prices for the station's region, one row per fuel. */
export function DoePricesSection({
  stationId,
  fuelTypes,
}: {
  stationId: string;
  fuelTypes: FuelType[];
}) {
  const { t } = useTranslation();
  const doe = useDoePricesForStation(stationId);
  const rows = doe.data ?? [];
  const first = rows[0];
  if (!first) return null;

  const label = (code: string) => fuelTypes.find((f) => f.code === code)?.label ?? code;
  const source = first.source_url;

  return (
    <View className="gap-2">
      <View>
        <Text accessibilityRole="header" className="font-bold text-lg text-ink">
          {t('doePrices.title', { region: first.region_name })}
        </Text>
        <Text className="text-xs text-ink-muted">
          {t('doePrices.week', {
            week: formatWeek(first.week_start, first.week_end),
            count: maxAreas(rows),
          })}
        </Text>
      </View>
      <View className="overflow-hidden rounded-2xl border border-line">
        {rows.map((r, i) => (
          <View
            key={r.fuel_type}
            className={`flex-row items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
            <Text className="text-base text-ink">{label(r.fuel_type)}</Text>
            <View className="items-end">
              <Text className="font-bold text-base text-ink">
                {t('doePrices.typical', { price: formatPrice(Number(r.typical_price)) })}
              </Text>
              <Text className="text-xs text-ink-muted">
                {formatRange(r.price_min, r.price_max)}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <Text className="text-xs text-ink-muted">{t('doePrices.note')}</Text>
      {source ? (
        <Text
          accessibilityRole="link"
          onPress={() => Linking.openURL(source)}
          className="font-semibold text-xs text-link underline">
          {t('doePrices.report')}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Map: the DOE's typical price for the selected fuel in the region around the map centre.
 * Dismissed per region and week; a new week (or another region) brings it back.
 */
export function DoePriceBanner({
  center,
  fuel,
  fuelTypes,
}: {
  center: LatLng;
  fuel: string;
  fuelTypes: FuelType[];
}) {
  const { t } = useTranslation();
  const doe = useDoePricesNear(center);
  const [dismissed, setDismissed] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_KEY)
      .then(setDismissed)
      .catch(() => setDismissed(null));
  }, []);

  const rows = doe.data ?? [];
  const key = weekKey(rows);
  const row = priceFor(rows, fuel);
  if (!key || !row || dismissed === undefined || dismissed === key) return null;

  const label = fuelTypes.find((f) => f.code === fuel)?.short_label ?? fuel;

  return (
    <View
      accessibilityRole="summary"
      className="mx-3 flex-row items-start gap-2 rounded-xl border border-action/30 bg-sky px-3 py-2.5">
      <Ionicons name="business" size={18} color="#0066D6" />
      <View className="flex-1 gap-0.5">
        <Text className="font-semibold text-sm text-ink">
          {t('doePrices.bannerTitle', {
            region: row.region_name,
            week: formatWeek(row.week_start, row.week_end),
          })}
        </Text>
        <Text className="text-xs text-ink">
          {t('doePrices.banner', {
            fuel: label,
            price: formatPrice(Number(row.typical_price)),
            range: formatRange(row.price_min, row.price_max),
          })}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('doePrices.dismiss')}
        hitSlop={10}
        onPress={() => {
          setDismissed(key);
          AsyncStorage.setItem(DISMISSED_KEY, key).catch(() => {});
        }}>
        <Ionicons name="close" size={18} className="text-ink-muted" />
      </Pressable>
    </View>
  );
}

const maxAreas = (rows: DoePrice[]) => rows.reduce((max, r) => Math.max(max, r.area_count), 0);
