import { useState } from 'react';
import { Switch, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { useToast } from '@/components/toast';
import {
  adminErrorMessage,
  useAdminStations,
  useUpdateStation,
  type AdminStation,
} from '@/features/admin/api';
import { AdminPage, Card, Empty, Pill } from '@/features/admin/ui';

export default function AdminStations() {
  const [search, setSearch] = useState('');
  const stations = useAdminStations(search);

  return (
    <AdminPage
      title="Stations"
      error={stations.error ? adminErrorMessage(stations.error) : null}
      onRefresh={() => stations.refetch()}
      refreshing={stations.isRefetching}>
      <TextInput
        accessibilityLabel="Search stations by name, brand, address or city"
        placeholder="Search by name, brand, address or city"
        placeholderTextColor="#8A8A8A"
        value={search}
        onChangeText={setSearch}
        autoCorrect={false}
        className="h-12 rounded-xl border border-line-strong px-3 font-sans text-base text-ink outline-none"
      />
      <Text className="text-sm text-ink-muted">
        Hidden stations disappear from the map and search, and can’t get new prices. Hidden ones are
        listed first.
      </Text>
      {stations.isPending ? <Empty>Loading…</Empty> : null}
      {stations.data?.length === 0 ? <Empty>No stations match.</Empty> : null}
      {stations.data?.map((station) => (
        <StationCard key={station.id} station={station} />
      ))}
    </AdminPage>
  );
}

function StationCard({ station }: { station: AdminStation }) {
  const update = useUpdateStation();
  const showToast = useToast((s) => s.show);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(station.name);
  const [address, setAddress] = useState(station.address ?? '');

  const save = (changes: Partial<AdminStation>, done: string) =>
    update.mutate(
      { id: station.id, ...changes },
      {
        onSuccess: () => {
          setEditing(false);
          showToast(done);
        },
        onError: (e) => showToast(adminErrorMessage(e), 'error'),
      },
    );

  return (
    <Card>
      <View className="flex-row items-start gap-3">
        <View className="flex-1 gap-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="font-bold text-base text-ink">{station.name}</Text>
            {station.brands ? <Pill label={station.brands.name} /> : null}
            {station.is_active ? null : <Pill label="Hidden" tone="danger" />}
          </View>
          <Text className="text-sm text-ink-muted">
            {[station.address, station.city].filter(Boolean).join(', ') || 'No address'}
          </Text>
        </View>
        <View className="items-center gap-1">
          <Switch
            accessibilityLabel={`Show ${station.name} on the map`}
            value={station.is_active}
            disabled={update.isPending}
            onValueChange={(visible) =>
              save({ is_active: visible }, visible ? 'Station is on the map.' : 'Station hidden.')
            }
          />
          <Text className="text-xs text-ink-muted">{station.is_active ? 'Shown' : 'Hidden'}</Text>
        </View>
      </View>

      {editing ? (
        <View className="gap-2">
          <TextInput
            accessibilityLabel="Station name"
            value={name}
            onChangeText={setName}
            maxLength={120}
            className="h-12 rounded-xl border border-line-strong px-3 font-sans text-base text-ink outline-none"
          />
          <TextInput
            accessibilityLabel="Station address"
            placeholder="Address"
            placeholderTextColor="#8A8A8A"
            value={address}
            onChangeText={setAddress}
            maxLength={200}
            className="h-12 rounded-xl border border-line-strong px-3 font-sans text-base text-ink outline-none"
          />
          <View className="flex-row gap-2">
            <Button
              label="Save"
              className="flex-1"
              loading={update.isPending}
              disabled={!name.trim()}
              onPress={() =>
                save({ name: name.trim(), address: address.trim() || null }, 'Station saved.')
              }
            />
            <Button
              label="Cancel"
              variant="outline"
              className="flex-1"
              onPress={() => {
                setName(station.name);
                setAddress(station.address ?? '');
                setEditing(false);
              }}
            />
          </View>
        </View>
      ) : (
        <Button label="Edit name or address" variant="outline" onPress={() => setEditing(true)} />
      )}
    </Card>
  );
}
