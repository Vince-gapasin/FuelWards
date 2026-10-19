import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/button';
import { Notice } from '@/components/notice';
import { ScreenHeader } from '@/components/screen-header';
import { useToast } from '@/components/toast';
import { usePendingReports, useStationDetails } from '@/features/reports/api';
import { directionsUrl, formatAge, formatPrice } from '@/features/stations/format';
import { PriceChart } from '@/features/stations/price-chart';
import {
  useFavoriteIds,
  useFuelTypes,
  usePriceHistory,
  useToggleFavorite,
} from '@/features/stations/use-stations';

// New screen: everything about one station. The prototype had five near-identical station pages.
export default function StationDetail() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const station = useStationDetails(id);
  const pending = usePendingReports(id);
  const history = usePriceHistory(id);
  const fuelTypes = useFuelTypes();
  const favorites = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();
  const showToast = useToast((s) => s.show);
  const [chartFuel, setChartFuel] = useState('GAS91');

  const saved = favorites.data?.has(id) ?? false;
  const prices = station.data?.prices ?? {};

  const onToggleFavorite = async () => {
    try {
      await toggleFavorite.mutateAsync({ stationId: id, save: !saved });
      showToast(saved ? t('station.removed') : t('station.saved'), 'info');
    } catch {
      showToast(t('station.saveFailed'), 'error');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader
        title={station.data?.name ?? t('station.title')}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saved ? t('station.unsave') : t('station.save')}
            aria-pressed={saved}
            hitSlop={8}
            onPress={onToggleFavorite}
            disabled={toggleFavorite.isPending || !favorites.isSuccess}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-sky">
            <Ionicons
              name={saved ? 'heart' : 'heart-outline'}
              size={24}
              className={saved ? 'text-danger' : 'text-ink'}
            />
          </Pressable>
        }
      />
      <ScrollView contentContainerClassName="px-5 py-5">
        <View className="w-full max-w-md gap-5 self-center">
          {station.isPending ? <ActivityIndicator color="#007BFF" /> : null}
          {station.isError ? <Notice tone="error" message={t('station.loadFailed')} /> : null}
          {station.data ? (
            <View>
              <Text accessibilityRole="header" className="font-bold text-2xl text-ink">
                {station.data.name}
              </Text>
              <Text className="text-sm text-ink-muted">
                {[station.data.brand, station.data.address].filter(Boolean).join(' · ') ||
                  t('station.fuelStation')}
              </Text>
            </View>
          ) : null}

          <View className="flex-row gap-2">
            <Button
              label={t('card.directions')}
              className="flex-1"
              disabled={!station.data}
              onPress={() => station.data && Linking.openURL(directionsUrl(station.data))}
            />
            <Button
              label={t('card.updatePrice')}
              variant="secondary"
              className="flex-1"
              onPress={() => router.push(`/report/${id}`)}
            />
          </View>

          {pending.data?.some((r) => !r.is_mine && !r.my_vote) ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/report/${id}`)}
              className="flex-row items-center gap-2 rounded-xl bg-star/30 p-3 active:bg-star/50">
              <Ionicons name="help-circle" size={20} className="text-emphasis" />
              <Text className="flex-1 text-sm text-emphasis">{t('station.helpConfirm')}</Text>
              <Ionicons name="chevron-forward" size={18} className="text-emphasis" />
            </Pressable>
          ) : null}

          <View className="gap-2">
            <Text className="font-bold text-lg text-ink">{t('station.currentPrices')}</Text>
            <View className="overflow-hidden rounded-2xl border border-line">
              {(fuelTypes.data ?? []).map((fuel, i) => {
                const p = prices[fuel.code];
                return (
                  <View
                    key={fuel.code}
                    className={`flex-row items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
                    <Text className="text-base text-ink">{fuel.label}</Text>
                    <View className="items-end">
                      <Text className="font-bold text-base text-ink">{formatPrice(p?.price)}</Text>
                      <Text className="text-[11px] text-ink-muted">
                        {p
                          ? t('card.updated', { age: formatAge(p.reported_at) })
                          : t('report.noPriceYet')}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <View className="gap-3">
            <Text className="font-bold text-lg text-ink">{t('station.last30')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2">
              {(fuelTypes.data ?? []).map((fuel) => (
                <Pressable
                  key={fuel.code}
                  accessibilityRole="radio"
                  aria-checked={chartFuel === fuel.code}
                  accessibilityLabel={fuel.label}
                  onPress={() => setChartFuel(fuel.code)}
                  className={`h-8 justify-center rounded-full border px-3 ${
                    chartFuel === fuel.code
                      ? 'border-action bg-action'
                      : 'border-line bg-surface active:bg-sky'
                  }`}>
                  <Text
                    className={`font-semibold text-xs ${chartFuel === fuel.code ? 'text-white' : 'text-ink'}`}>
                    {fuel.short_label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            {history.isPending ? (
              <ActivityIndicator color="#007BFF" />
            ) : (
              <PriceChart points={history.data?.[chartFuel] ?? []} />
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
