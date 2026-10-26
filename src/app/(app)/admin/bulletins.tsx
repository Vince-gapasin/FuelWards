import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { useToast } from '@/components/toast';
import {
  adminErrorMessage,
  useAddBulletins,
  useAnnounceBulletin,
  useAuditLog,
  useBulletins,
  useDeleteBulletin,
  type Bulletin,
} from '@/features/admin/api';
import { bulletinRows, nextAdjustmentDate } from '@/features/admin/format';
import { AdminPage, Card, Empty, Pill } from '@/features/admin/ui';
import { formatChange, formatEffectiveDate } from '@/features/doe/bulletin';
import { useFuelTypes } from '@/features/stations/use-stations';

const input =
  'h-12 rounded-xl border border-line-strong px-3 font-sans text-base text-ink outline-none';

export default function AdminBulletins() {
  const bulletins = useBulletins();
  const fuelTypes = useFuelTypes();
  const log = useAuditLog();
  const announced = new Set(
    (log.data ?? []).filter((a) => a.action === 'announce_bulletin').map((a) => a.target_id),
  );
  const label = (code: string) => fuelTypes.data?.find((f) => f.code === code)?.short_label ?? code;

  const byDate = useMemo(() => {
    const groups = new Map<string, Bulletin[]>();
    for (const b of bulletins.data ?? []) {
      groups.set(b.effective_date, [...(groups.get(b.effective_date) ?? []), b]);
    }
    return [...groups.entries()];
  }, [bulletins.data]);

  return (
    <AdminPage
      title="DOE bulletins"
      error={bulletins.error ? adminErrorMessage(bulletins.error) : null}
      onRefresh={() => bulletins.refetch()}
      refreshing={bulletins.isRefetching}>
      <Text className="text-sm text-ink-muted">
        Enter the Department of Energy’s weekly adjustment for Metro Manila. The home screen shows
        it from 6 days before to 7 days after it takes effect. Saving a fuel and date that already
        exist replaces them.
      </Text>
      {fuelTypes.data ? (
        <BulletinForm fuels={fuelTypes.data.map((f) => f.code)} label={label} />
      ) : null}

      <Text className="pt-2 font-bold text-lg text-ink">On file</Text>
      {bulletins.isPending ? <Empty>Loading…</Empty> : null}
      {bulletins.data?.length === 0 ? <Empty>No bulletins yet.</Empty> : null}
      {byDate.map(([date, rows]) => (
        <Card key={date}>
          <Text className="font-bold text-base text-ink">{formatEffectiveDate(date)}</Text>
          {rows.map((row) => (
            <BulletinRow key={row.id} row={row} fuel={label(row.fuel_type)} />
          ))}
          {rows[0].source_url ? (
            <Text className="text-xs text-ink-muted" numberOfLines={1}>
              Source: {rows[0].source_url}
            </Text>
          ) : null}
          <AnnounceButton date={date} announced={announced.has(date)} />
        </Card>
      ))}
    </AdminPage>
  );
}

/** Notifies drivers about this week's change. Each week can be announced once. */
function AnnounceButton({ date, announced }: { date: string; announced: boolean }) {
  const announce = useAnnounceBulletin();
  const showToast = useToast((s) => s.show);
  if (announced) return <Pill label="Drivers notified" tone="good" />;
  return (
    <Button
      label="Notify drivers"
      variant="outline"
      loading={announce.isPending}
      onPress={() =>
        announce.mutate(date, {
          onSuccess: (count) =>
            showToast(count === 1 ? 'Sent to 1 driver.' : `Sent to ${count} drivers.`),
          onError: (e) => showToast(adminErrorMessage(e), 'error'),
        })
      }
    />
  );
}

function BulletinRow({ row, fuel }: { row: Bulletin; fuel: string }) {
  const remove = useDeleteBulletin();
  const showToast = useToast((s) => s.show);
  return (
    <View className="min-h-11 flex-row items-center gap-3 border-t border-line pt-1">
      <Text className="w-20 font-semibold text-sm text-ink">{fuel}</Text>
      <Text className="flex-1 text-sm text-ink">
        {formatChange(row.change_min, row.change_max)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Delete the ${fuel} change`}
        hitSlop={8}
        disabled={remove.isPending}
        onPress={() =>
          remove.mutate(row.id, {
            onSuccess: () => showToast('Deleted.'),
            onError: (e) => showToast(adminErrorMessage(e), 'error'),
          })
        }
        className="h-11 w-11 items-center justify-center rounded-full active:bg-sky">
        <Ionicons name="trash-outline" size={20} className="text-ink-muted" />
      </Pressable>
    </View>
  );
}

function BulletinForm({ fuels, label }: { fuels: string[]; label: (code: string) => string }) {
  const add = useAddBulletins();
  const showToast = useToast((s) => s.show);
  const [date, setDate] = useState(nextAdjustmentDate);
  const [source, setSource] = useState('');
  const [values, setValues] = useState<Record<string, { min: string; max: string }>>({});
  const [error, setError] = useState<string | null>(null);

  const set = (fuel: string, end: 'min' | 'max', text: string) =>
    setValues((v) => ({ ...v, [fuel]: { ...(v[fuel] ?? { min: '', max: '' }), [end]: text } }));

  const submit = () => {
    const { rows, error: problem } = bulletinRows(
      date,
      fuels.map((f) => ({ fuel_type: f, min: values[f]?.min ?? '', max: values[f]?.max ?? '' })),
      source,
    );
    if (problem) return setError(problem);
    setError(null);
    add.mutate(rows, {
      onSuccess: () => {
        setValues({});
        showToast('Bulletin saved.');
      },
      onError: (e) => setError(adminErrorMessage(e)),
    });
  };

  return (
    <Card>
      <Text className="font-bold text-base text-ink">New bulletin</Text>
      <Text className="text-sm text-ink">Takes effect (YYYY-MM-DD)</Text>
      <TextInput
        accessibilityLabel="Date it takes effect, as year-month-day"
        value={date}
        onChangeText={setDate}
        autoCorrect={false}
        className={input}
      />
      <Text className="text-sm text-ink-muted">
        Peso change per litre. Use a minus sign for rollbacks. Leave a fuel blank to skip it, or
        fill one box if every company moves by the same amount.
      </Text>
      {fuels.map((fuel) => (
        <View key={fuel} className="flex-row items-center gap-2">
          <Text numberOfLines={1} className="w-16 font-semibold text-sm text-ink">
            {label(fuel)}
          </Text>
          <TextInput
            accessibilityLabel={`${label(fuel)} lowest change`}
            placeholder="from"
            placeholderTextColor="#8A8A8A"
            value={values[fuel]?.min ?? ''}
            onChangeText={(t) => set(fuel, 'min', t)}
            keyboardType="numbers-and-punctuation"
            className={`min-w-0 flex-1 ${input}`}
          />
          <TextInput
            accessibilityLabel={`${label(fuel)} highest change`}
            placeholder="to"
            placeholderTextColor="#8A8A8A"
            value={values[fuel]?.max ?? ''}
            onChangeText={(t) => set(fuel, 'max', t)}
            keyboardType="numbers-and-punctuation"
            className={`min-w-0 flex-1 ${input}`}
          />
        </View>
      ))}
      <TextInput
        accessibilityLabel="Source link"
        placeholder="Source link (DOE advisory or news story)"
        placeholderTextColor="#8A8A8A"
        value={source}
        onChangeText={setSource}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        className={input}
      />
      {error ? (
        <Text accessibilityRole="alert" className="text-sm text-critical">
          {error}
        </Text>
      ) : null}
      <Button label="Save bulletin" loading={add.isPending} onPress={submit} />
    </Card>
  );
}
