import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { FuelType } from '@/features/stations/types';
import { supabase } from '@/lib/supabase';

import { bulletinTone, formatChange, formatEffectiveDate, type BulletinRow } from './bulletin';

const DISMISSED_KEY = 'fw.doeDismissed';

const tones = {
  hike: { box: 'bg-danger/10 border-danger/30', icon: 'trending-up', color: '#BB0000' },
  rollback: { box: 'bg-brand/10 border-brand/30', icon: 'trending-down', color: '#00BF63' },
  mixed: { box: 'bg-sky border-action/30', icon: 'swap-vertical', color: '#0066D6' },
} as const;

/** This week's DOE price adjustment, shown on the map until the user dismisses it. */
export function DoeBanner({ fuelTypes }: { fuelTypes: FuelType[] }) {
  const { t } = useTranslation();
  const bulletin = useQuery({
    queryKey: ['doe-bulletin'],
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('current_doe_bulletin');
      if (error) throw error;
      return data as BulletinRow[];
    },
  });
  const [dismissed, setDismissed] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_KEY)
      .then(setDismissed)
      .catch(() => setDismissed(null));
  }, []);

  const rows = bulletin.data ?? [];
  const date = rows[0]?.effective_date;
  if (!date || dismissed === undefined || dismissed === date) return null;

  const tone = tones[bulletinTone(rows)];
  const label = (code: string) => fuelTypes.find((f) => f.code === code)?.short_label ?? code;
  const source = rows.find((r) => r.source_url)?.source_url;

  return (
    <View
      accessibilityRole="summary"
      className={`mx-3 flex-row items-start gap-2 rounded-xl border px-3 py-2.5 ${tone.box}`}>
      <Ionicons name={tone.icon} size={18} color={tone.color} />
      <View className="flex-1 gap-0.5">
        <Text className="font-semibold text-sm text-ink">
          {t('doe.title', { date: formatEffectiveDate(date) })}
        </Text>
        <Text className="text-xs text-ink">
          {rows
            .map((r) => `${label(r.fuel_type)} ${formatChange(r.change_min, r.change_max)}`)
            .join(' · ')}
        </Text>
        {source ? (
          <Text
            accessibilityRole="link"
            onPress={() => Linking.openURL(source)}
            className="font-semibold text-xs text-link underline">
            {t('doe.source')}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('doe.dismiss')}
        hitSlop={10}
        onPress={() => {
          setDismissed(date);
          AsyncStorage.setItem(DISMISSED_KEY, date).catch(() => {});
        }}>
        <Ionicons name="close" size={18} className="text-ink-muted" />
      </Pressable>
    </View>
  );
}
