import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { FuelType } from '@/features/stations/types';
import { supabase } from '@/lib/supabase';

import { formatWeeklyItem, minStations, weeklyTone, type WeeklyPrice } from './weekly';

const DISMISSED_KEY = 'fw.weeklyDismissed';

const tones = {
  hike: { box: 'bg-danger/10 border-danger/30', icon: 'trending-up', color: '#BB0000' },
  rollback: { box: 'bg-brand/10 border-brand/30', icon: 'trending-down', color: '#00BF63' },
  mixed: { box: 'bg-sky border-action/30', icon: 'people', color: '#0066D6' },
} as const;

/**
 * This week's prices worked out from drivers' confirmed reports (updated daily by the database).
 * Shown on the map until dismissed; a new week brings it back.
 */
export function WeeklyPriceBanner({ fuelTypes }: { fuelTypes: FuelType[] }) {
  const { t } = useTranslation();
  const weekly = useQuery({
    queryKey: ['weekly-prices'],
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('current_weekly_prices');
      if (error) throw error;
      return data as WeeklyPrice[];
    },
  });
  const [dismissed, setDismissed] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_KEY)
      .then(setDismissed)
      .catch(() => setDismissed(null));
  }, []);

  const rows = weekly.data ?? [];
  const week = rows[0]?.week_start;
  if (!week || dismissed === undefined || dismissed === week) return null;

  const tone = tones[weeklyTone(rows)];
  const label = (code: string) => fuelTypes.find((f) => f.code === code)?.short_label ?? code;

  return (
    <View
      accessibilityRole="summary"
      className={`mx-3 flex-row items-start gap-2 rounded-xl border px-3 py-2.5 ${tone.box}`}>
      <Ionicons name={tone.icon} size={18} color={tone.color} />
      <View className="flex-1 gap-0.5">
        <Text className="font-semibold text-sm text-ink">{t('weekly.title')}</Text>
        <Text className="text-xs text-ink">
          {rows.map((r) => formatWeeklyItem(r, label(r.fuel_type))).join(' · ')}
        </Text>
        <Text className="text-xs text-ink-muted">
          {t('weekly.basis', { count: minStations(rows) })}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('weekly.dismiss')}
        hitSlop={10}
        onPress={() => {
          setDismissed(week);
          AsyncStorage.setItem(DISMISSED_KEY, week).catch(() => {});
        }}>
        <Ionicons name="close" size={18} className="text-ink-muted" />
      </Pressable>
    </View>
  );
}
