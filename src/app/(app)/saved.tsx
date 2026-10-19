import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Notice } from '@/components/notice';
import { ScreenHeader } from '@/components/screen-header';
import { useUserLocation } from '@/features/location/use-location';
import { formatDistance, formatPrice } from '@/features/stations/format';
import { useFavoriteStations } from '@/features/stations/use-stations';

const FALLBACK = { latitude: 14.6008, longitude: 121.0067 };

export default function SavedStations() {
  const { t } = useTranslation();
  const { location } = useUserLocation();
  const saved = useFavoriteStations(location ?? FALLBACK);

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader title={t('saved.title')} />
      <ScrollView contentContainerClassName="px-4 py-4">
        <View className="w-full max-w-md gap-3 self-center">
          {saved.isPending ? <ActivityIndicator color="#007BFF" /> : null}
          {saved.isError ? <Notice tone="error" message={t('saved.loadFailed')} /> : null}
          {saved.data?.length === 0 ? (
            <View className="items-center gap-2 py-10">
              <Ionicons name="heart-outline" size={40} className="text-ink-subtle" />
              <Text className="text-center text-base text-ink-muted">{t('saved.empty')}</Text>
            </View>
          ) : null}
          {saved.data?.map((s) => (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              onPress={() => router.push(`/station/${s.id}`)}
              className="gap-2 rounded-2xl border border-line bg-surface p-4 active:bg-sky">
              <View className="flex-row items-center justify-between">
                <Text numberOfLines={1} className="flex-1 font-bold text-base text-ink">
                  {s.name}
                </Text>
                <Text className="text-xs text-ink-muted">{formatDistance(s.distance_m)}</Text>
              </View>
              {s.address ? <Text className="text-xs text-ink-muted">{s.address}</Text> : null}
              <View className="flex-row gap-4">
                {(['GAS91', 'GAS95', 'DIESEL'] as const).map((code) => (
                  <Text key={code} className="text-sm text-ink">
                    <Text className="text-ink-muted">
                      {code === 'GAS91' ? 'Reg 91' : code === 'GAS95' ? 'Prem 95' : 'Diesel'}{' '}
                    </Text>
                    {formatPrice(s.prices[code]?.price)}
                  </Text>
                ))}
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
