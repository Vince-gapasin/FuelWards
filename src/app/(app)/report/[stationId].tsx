import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Notice } from '@/components/notice';
import { useToast } from '@/components/toast';
import { useUserLocation } from '@/features/location/use-location';
import {
  usePendingReports,
  useStationDetails,
  useSubmitReport,
  useVote,
  type PendingReport,
} from '@/features/reports/api';
import { LocationRequiredError, reportErrorMessage } from '@/features/reports/errors';
import { parsePriceInputs } from '@/features/reports/prices';
import { formatAge, formatPrice } from '@/features/stations/format';
import { useFuelTypes } from '@/features/stations/use-stations';

// Figma: "Edit Price" (40:354), now for the station that was tapped (the prototype always said
// "Updating Cleanfuel"), plus voting on other drivers' pending prices.
export default function ReportPrices() {
  const { stationId } = useLocalSearchParams<{ stationId: string }>();
  const station = useStationDetails(stationId);
  const pending = usePendingReports(stationId);
  const fuelTypes = useFuelTypes();
  const submit = useSubmitReport(stationId);
  const vote = useVote();
  const { locate } = useUserLocation();
  const showToast = useToast((s) => s.show);

  const [values, setValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [votingId, setVotingId] = useState<string | null>(null);

  const label = (code: string) => fuelTypes.data?.find((f) => f.code === code)?.short_label ?? code;
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const onSubmit = async () => {
    setFormError(null);
    const { prices, errors } = parsePriceInputs(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    if (!Object.keys(prices).length) return setFormError('Enter at least one price.');
    try {
      const here = await locate();
      if (!here) throw new LocationRequiredError();
      const result = await submit.mutateAsync({ prices, at: here });
      showToast(
        result.flagged
          ? `Thanks! +${result.pending_points} points pending. This price is unusual, so it needs extra confirmations.`
          : `Thanks! +${result.pending_points} points pending until the price is confirmed.`,
      );
      close();
    } catch (e) {
      setFormError(reportErrorMessage(e, label));
    }
  };

  const onVote = async (report: PendingReport, choice: 'confirm' | 'dispute') => {
    setFormError(null);
    setVotingId(report.id);
    try {
      const here = await locate();
      if (!here) throw new LocationRequiredError();
      const result = await vote.mutateAsync({ reportId: report.id, vote: choice, at: here });
      if (result.status === 'verified') {
        showToast(
          choice === 'confirm'
            ? '+2 points! Price confirmed.'
            : 'Price confirmed by other drivers.',
        );
      } else if (result.status === 'rejected') {
        showToast(
          choice === 'dispute'
            ? '+2 points! Wrong price removed.'
            : 'Other drivers rejected this price.',
          'info',
        );
      } else {
        showToast('Thanks for voting! Points arrive once the price is decided.', 'info');
      }
    } catch (e) {
      setFormError(reportErrorMessage(e, label));
    } finally {
      setVotingId(null);
    }
  };

  const others = pending.data?.filter((r) => !r.is_mine) ?? [];
  const mine = pending.data?.filter((r) => r.is_mine) ?? [];

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center justify-between border-b border-line px-4 py-2">
        <View className="flex-row items-center gap-2">
          <Ionicons name="create-outline" size={22} color="#00BF63" />
          <Text accessibilityRole="header" className="font-bold text-lg text-ink">
            Update prices
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={10}
          onPress={close}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-sky">
          <Ionicons name="close" size={24} color="#1D1B20" />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1">
        <ScrollView contentContainerClassName="gap-5 px-5 py-5" keyboardShouldPersistTaps="handled">
          <View className="w-full max-w-md gap-5 self-center">
            {station.isPending ? <ActivityIndicator color="#007BFF" /> : null}
            {station.data ? (
              <View>
                <Text className="font-bold text-xl text-ink">{station.data.name}</Text>
                {station.data.address ? (
                  <Text className="text-sm text-ink-muted">{station.data.address}</Text>
                ) : null}
              </View>
            ) : null}

            <View className="flex-row items-center gap-3 rounded-xl bg-sky p-3">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-brand">
                <Ionicons name="star" size={18} color="#FFFFFF" />
              </View>
              <View className="flex-1">
                <Text className="font-bold text-base text-navy">Earn +10 points per price</Text>
                <Text className="text-xs text-ink-muted">
                  Points are added once other drivers confirm your price.
                </Text>
              </View>
            </View>

            {formError ? <Notice tone="error" message={formError} /> : null}

            {others.length ? (
              <View className="gap-2">
                <Text className="font-semibold text-base text-ink">Is this price right?</Text>
                <Text className="text-xs text-ink-muted">
                  Earn +2 points when your vote matches the final result.
                </Text>
                {others.map((r) => (
                  <View key={r.id} className="gap-2 rounded-xl border border-line p-3">
                    <View className="flex-row items-center justify-between">
                      <Text className="font-semibold text-sm text-ink">
                        {label(r.fuel_type)} · {formatPrice(r.price)}
                      </Text>
                      <Text className="text-xs text-ink-muted">
                        {formatAge(r.reported_at)} · {r.confirms}/{r.needed} confirms
                      </Text>
                    </View>
                    {r.flagged ? (
                      <Text className="text-xs text-points">
                        Unusual compared with nearby stations, so it needs extra confirmations.
                      </Text>
                    ) : null}
                    {r.my_vote ? (
                      <Text className="text-xs text-ink-muted">
                        You voted {r.my_vote === 'confirm' ? '“correct”' : '“wrong”'}.
                      </Text>
                    ) : (
                      <View className="flex-row gap-2">
                        <Button
                          label="Correct"
                          variant="secondary"
                          className="h-10 flex-1"
                          loading={votingId === r.id && vote.variables?.vote === 'confirm'}
                          disabled={votingId !== null}
                          onPress={() => onVote(r, 'confirm')}
                        />
                        <Button
                          label="Wrong"
                          variant="outline"
                          className="h-10 flex-1"
                          loading={votingId === r.id && vote.variables?.vote === 'dispute'}
                          disabled={votingId !== null}
                          onPress={() => onVote(r, 'dispute')}
                        />
                      </View>
                    )}
                  </View>
                ))}
              </View>
            ) : null}

            {mine.length ? (
              <Notice
                tone="info"
                message={`Your ${mine.map((r) => `${label(r.fuel_type)} ${formatPrice(r.price)}`).join(', ')} ${
                  mine.length === 1 ? 'is' : 'are'
                } waiting for confirmation.`}
              />
            ) : null}

            <View className="gap-3">
              <Text className="font-semibold text-base text-ink">Report current prices</Text>
              {(fuelTypes.data ?? []).map((fuel) => {
                const current = station.data?.prices[fuel.code];
                return (
                  <View key={fuel.code} className="gap-1">
                    <View className="flex-row items-center gap-3">
                      <View className="w-24">
                        <Text className="font-semibold text-sm text-ink">{fuel.short_label}</Text>
                        <Text className="text-[11px] text-ink-muted">
                          {current ? `Now ${formatPrice(current.price)}` : 'No price yet'}
                        </Text>
                      </View>
                      <View
                        className={`h-12 flex-1 flex-row items-center rounded-lg border bg-sky/50 px-3 ${
                          fieldErrors[fuel.code] ? 'border-danger' : 'border-line-strong'
                        }`}>
                        <Text className="font-semibold text-base text-ink">₱</Text>
                        <TextInput
                          accessibilityLabel={`${fuel.label} price`}
                          value={values[fuel.code] ?? ''}
                          onChangeText={(text) => setValues((v) => ({ ...v, [fuel.code]: text }))}
                          placeholder={current ? current.price.toFixed(2) : '0.00'}
                          placeholderTextColor="#9A9A9A"
                          keyboardType="decimal-pad"
                          inputMode="decimal"
                          maxLength={6}
                          className="h-full flex-1 px-1 font-semibold text-base text-ink outline-none"
                        />
                      </View>
                    </View>
                    {fieldErrors[fuel.code] ? (
                      <Text accessibilityRole="alert" className="text-right text-xs text-danger">
                        {fieldErrors[fuel.code]}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
              <Text className="text-xs text-ink-muted">
                Fill in only the prices you can see on the station’s price board. We use your
                location to check you’re at the station.
              </Text>
            </View>

            <Button
              label="Submit prices"
              variant="secondary"
              onPress={onSubmit}
              loading={submit.isPending}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
