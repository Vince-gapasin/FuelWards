import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { adminErrorMessage, useOverview } from '@/features/admin/api';
import { AdminPage, NavRow, Stat } from '@/features/admin/ui';

export default function AdminHome() {
  const overview = useOverview();
  const o = overview.data;

  return (
    <AdminPage
      title="Admin console"
      loading={overview.isPending}
      error={overview.error ? adminErrorMessage(overview.error) : null}
      onRefresh={() => overview.refetch()}
      refreshing={overview.isRefetching}>
      <View className="gap-2">
        <Text className="font-bold text-lg text-ink">Needs attention</Text>
        <View className="flex-row flex-wrap gap-2">
          <Stat
            label="Unusual prices waiting"
            value={o?.flagged}
            tone="warn"
            onPress={() => router.push('/admin/reports')}
          />
          <Stat
            label="All prices waiting"
            value={o?.pending}
            onPress={() =>
              router.push({ pathname: '/admin/reports', params: { filter: 'pending' } })
            }
          />
          <Stat
            label="Banned users"
            value={o?.banned}
            onPress={() => router.push('/admin/users')}
          />
        </View>
      </View>

      <View className="gap-2">
        <Text className="font-bold text-lg text-ink">Activity</Text>
        <View className="flex-row flex-wrap gap-2">
          <Stat label="Prices in the last 24 h" value={o?.reports_today} />
          <Stat label="Users" value={o?.users} />
          <Stat label="New users this week" value={o?.new_users_week} />
          <Stat label="Vouchers this week" value={o?.redemptions_week} />
          <Stat label="Stations on the map" value={o?.stations} />
          <Stat label="Hidden stations" value={o?.hidden_stations} />
        </View>
      </View>

      <View className="overflow-hidden rounded-2xl border border-line">
        <NavRow
          first
          icon="pricetags-outline"
          label="Price reports"
          hint="Confirm or reject prices the community can't settle"
          onPress={() => router.push('/admin/reports')}
        />
        <NavRow
          icon="people-outline"
          label="Users"
          hint="Find users and ban abusers"
          onPress={() => router.push('/admin/users')}
        />
        <NavRow
          icon="location-outline"
          label="Stations"
          hint="Fix names and addresses, hide closed stations"
          onPress={() => router.push('/admin/stations')}
        />
        <NavRow
          icon="gift-outline"
          label="Rewards"
          hint="Edit the voucher catalog"
          onPress={() => router.push('/admin/rewards')}
        />
        <NavRow
          icon="megaphone-outline"
          label="DOE bulletins"
          hint="Enter the weekly price adjustment"
          onPress={() => router.push('/admin/bulletins')}
        />
        <NavRow
          icon="list-outline"
          label="Activity log"
          hint="Every admin action, newest first"
          onPress={() => router.push('/admin/log')}
        />
      </View>
    </AdminPage>
  );
}
