import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/button';
import { Notice } from '@/components/notice';
import { ScreenHeader } from '@/components/screen-header';
import { useToast } from '@/components/toast';
import {
  alertErrorMessage,
  useAlertInbox,
  useCreateAlert,
  useDeleteAlert,
  useMarkAlertsRead,
  useMyAlerts,
  useSetAlertActive,
  useNotifySettings,
  useSetNotifyDoe,
} from '@/features/alerts/api';
import { enablePush, getPushStatus } from '@/features/alerts/push';
import type { PushStatus } from '@/features/alerts/push-types';
import { useUserLocation } from '@/features/location/use-location';
import { parsePriceInputs } from '@/features/reports/prices';
import { formatAge, formatDistance, formatPrice } from '@/features/stations/format';
import { useFavoriteStations, useFuelTypes } from '@/features/stations/use-stations';

const RADII = [1000, 3000, 5000, 10000];

const pushCopy: Record<PushStatus, string> = {
  unsupported: 'alerts.push.unsupported',
  'not-configured': 'alerts.push.notConfigured',
  off: 'alerts.push.off',
  denied: 'alerts.push.denied',
  on: 'alerts.push.on',
};

export default function Alerts() {
  const { t } = useTranslation();
  const alerts = useMyAlerts();
  const inbox = useAlertInbox();
  const fuelTypes = useFuelTypes();
  const create = useCreateAlert();
  const setActive = useSetAlertActive();
  const remove = useDeleteAlert();
  const markRead = useMarkAlertsRead();
  const showToast = useToast((s) => s.show);
  const { locate } = useUserLocation();
  const saved = useFavoriteStations({ latitude: 14.6008, longitude: 121.0067 });

  const [push, setPush] = useState<PushStatus | null>(null);
  const [fuel, setFuel] = useState('DIESEL');
  const [maxPrice, setMaxPrice] = useState('');
  const [where, setWhere] = useState<'near' | string>('near');
  const [radius, setRadius] = useState(3000);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPushStatus()
      .then(setPush)
      .catch(() => setPush('unsupported'));
  }, []);

  // Opening the screen counts as reading the inbox.
  const unread = inbox.data?.some((m) => !m.read_at);
  useEffect(() => {
    if (unread) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread]);

  const label = (code: string) => fuelTypes.data?.find((f) => f.code === code)?.short_label ?? code;

  const onCreate = async () => {
    setError(null);
    const { prices, errors } = parsePriceInputs({ [fuel]: maxPrice });
    if (errors[fuel]) return setError(errors[fuel]);
    if (prices[fuel] == null) return setError(t('alerts.enterMax'));
    try {
      if (where === 'near') {
        const here = await locate();
        if (!here) return setError(t('alerts.needLocation'));
        await create.mutateAsync({
          fuelType: fuel,
          maxPrice: prices[fuel],
          radiusM: radius,
          at: here,
        });
      } else {
        await create.mutateAsync({
          fuelType: fuel,
          maxPrice: prices[fuel],
          radiusM: radius,
          stationId: where,
        });
      }
      setMaxPrice('');
      showToast(t('alerts.savedToast'));
    } catch (e) {
      setError(alertErrorMessage(e));
    }
  };

  const settings = useNotifySettings();
  const setNotifyDoe = useSetNotifyDoe();

  const onEnablePush = async () => {
    try {
      setPush(await enablePush());
    } catch {
      showToast(t('alerts.pushFailed'), 'error');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader title={t('alerts.title')} />
      <ScrollView contentContainerClassName="px-5 py-5" keyboardShouldPersistTaps="handled">
        <View className="w-full max-w-md gap-6 self-center">
          {push ? (
            <View className="flex-row items-center gap-3 rounded-2xl bg-sky p-3">
              <Ionicons
                name={push === 'on' ? 'notifications' : 'notifications-off-outline'}
                size={22}
                className="text-emphasis"
              />
              <Text className="flex-1 text-sm text-ink">{t(pushCopy[push])}</Text>
              {push === 'off' ? (
                <Button label={t('alerts.turnOn')} className="h-9 px-4" onPress={onEnablePush} />
              ) : null}
            </View>
          ) : null}

          <View className="flex-row items-center gap-3 rounded-2xl border border-line p-3">
            <Ionicons name="megaphone-outline" size={22} className="text-emphasis" />
            <View className="flex-1">
              <Text className="font-semibold text-sm text-ink">{t('alerts.doeTitle')}</Text>
              <Text className="text-xs text-ink-muted">{t('alerts.doeHint')}</Text>
            </View>
            <Switch
              accessibilityLabel={t('alerts.doeTitle')}
              value={settings.data?.notify_doe ?? true}
              disabled={!settings.data || setNotifyDoe.isPending}
              onValueChange={(on) =>
                setNotifyDoe.mutate(on, {
                  onError: () => showToast(t('common.genericError'), 'error'),
                })
              }
              trackColor={{ true: '#00BF63', false: '#D9D9D9' }}
            />
          </View>

          <View className="gap-3">
            <Text className="font-bold text-lg text-ink">{t('alerts.newAlert')}</Text>
            <View className="flex-row flex-wrap gap-2">
              {(fuelTypes.data ?? []).map((f) => (
                <Pressable
                  key={f.code}
                  accessibilityRole="radio"
                  aria-checked={fuel === f.code}
                  accessibilityLabel={f.label}
                  onPress={() => setFuel(f.code)}
                  hitSlop={{ top: 6, bottom: 6 }}
                  className={`h-8 justify-center rounded-full border px-3 ${
                    fuel === f.code
                      ? 'border-action bg-action'
                      : 'border-line bg-surface active:bg-sky'
                  }`}>
                  <Text
                    className={`font-semibold text-xs ${fuel === f.code ? 'text-white' : 'text-ink'}`}>
                    {f.short_label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View className="flex-row items-center gap-3">
              <Text className="text-sm text-ink">{t('alerts.atOrBelow')}</Text>
              <View className="h-11 flex-1 flex-row items-center rounded-lg border border-line-strong px-3">
                <Text className="font-semibold text-base text-ink">₱</Text>
                <TextInput
                  accessibilityLabel={t('alerts.maxLabel')}
                  value={maxPrice}
                  onChangeText={setMaxPrice}
                  placeholder="58.00"
                  placeholderTextColor="#9A9A9A"
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  maxLength={6}
                  className="h-full flex-1 px-1 font-semibold text-base text-ink outline-none"
                />
              </View>
            </View>

            <Text className="text-sm text-ink">{t('alerts.where')}</Text>
            <View className="gap-2">
              <Pressable
                accessibilityRole="radio"
                aria-checked={where === 'near'}
                onPress={() => setWhere('near')}
                className={`rounded-xl border p-3 ${where === 'near' ? 'border-action bg-sky' : 'border-line'}`}>
                <Text className="font-semibold text-sm text-ink">{t('alerts.nearMe')}</Text>
                {where === 'near' ? (
                  <View className="mt-2 flex-row gap-2">
                    {RADII.map((r) => (
                      <Pressable
                        key={r}
                        accessibilityRole="radio"
                        aria-checked={radius === r}
                        onPress={() => setRadius(r)}
                        hitSlop={{ top: 6, bottom: 6 }}
                        className={`h-8 flex-1 items-center justify-center rounded-full border ${
                          radius === r ? 'border-navy bg-navy' : 'border-line bg-surface'
                        }`}>
                        <Text
                          className={`font-semibold text-xs ${radius === r ? 'text-white' : 'text-ink'}`}>
                          {t('alerts.km', { count: r / 1000 })}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </Pressable>
              {saved.data?.map((s) => (
                <Pressable
                  key={s.id}
                  accessibilityRole="radio"
                  aria-checked={where === s.id}
                  onPress={() => setWhere(s.id)}
                  className={`rounded-xl border p-3 ${where === s.id ? 'border-action bg-sky' : 'border-line'}`}>
                  <Text className="font-semibold text-sm text-ink">{s.name}</Text>
                  {s.address ? <Text className="text-xs text-ink-muted">{s.address}</Text> : null}
                </Pressable>
              ))}
              {saved.data?.length === 0 ? (
                <Text className="text-xs text-ink-muted">{t('alerts.tipSave')}</Text>
              ) : null}
            </View>

            {error ? <Notice tone="error" message={error} /> : null}
            <Button
              label={t('alerts.saveAlert')}
              variant="secondary"
              onPress={onCreate}
              loading={create.isPending}
            />
          </View>

          <View className="gap-2">
            <Text className="font-bold text-lg text-ink">{t('alerts.mine')}</Text>
            {alerts.isPending ? <ActivityIndicator color="#0066D6" /> : null}
            {alerts.data?.length === 0 ? (
              <Text className="text-sm text-ink-muted">{t('alerts.none')}</Text>
            ) : null}
            {alerts.data?.map((a) => (
              <View
                key={a.id}
                className="flex-row items-center gap-3 rounded-2xl border border-line p-3">
                <View className="flex-1">
                  <Text className="font-semibold text-sm text-ink">
                    {t('alerts.summary', {
                      fuel: label(a.fuel_type),
                      price: formatPrice(a.max_price),
                    })}
                  </Text>
                  <Text className="text-xs text-ink-muted">
                    {a.station_name ?? t('alerts.within', { distance: formatDistance(a.radius_m) })}
                  </Text>
                </View>
                <Switch
                  accessibilityLabel={a.is_active ? t('alerts.pause') : t('alerts.resume')}
                  value={a.is_active}
                  onValueChange={(active) => setActive.mutate({ id: a.id, active })}
                  trackColor={{ true: '#00BF63', false: '#D9D9D9' }}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('alerts.delete')}
                  hitSlop={8}
                  onPress={() => remove.mutate(a.id)}>
                  <Ionicons name="trash-outline" size={20} color="#BB0000" />
                </Pressable>
              </View>
            ))}
          </View>

          <View className="gap-2">
            <Text className="font-bold text-lg text-ink">{t('alerts.matches')}</Text>
            {inbox.data?.length === 0 ? (
              <Text className="text-sm text-ink-muted">{t('alerts.matchesEmpty')}</Text>
            ) : null}
            {inbox.data?.map((m) => (
              <Pressable
                key={m.id}
                accessibilityRole="button"
                onPress={() => router.push(`/station/${m.station_id}`)}
                className={`flex-row items-center gap-3 rounded-2xl border p-3 active:bg-sky ${
                  m.read_at ? 'border-line' : 'border-action bg-sky'
                }`}>
                <Ionicons name="pricetag" size={20} className="text-positive" />
                <View className="flex-1">
                  <Text className="font-semibold text-sm text-ink">
                    {t('alerts.match', {
                      fuel: label(m.fuel_type),
                      price: formatPrice(m.price),
                      station: m.station?.name ?? t('alerts.aStation'),
                    })}
                  </Text>
                  <Text className="text-xs text-ink-muted">{formatAge(m.created_at)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} className="text-ink-subtle" />
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
