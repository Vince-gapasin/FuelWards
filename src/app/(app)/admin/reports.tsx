import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Segmented } from '@/components/segmented';
import { useToast } from '@/components/toast';
import {
  adminErrorMessage,
  useDecideReport,
  useReportQueue,
  type QueueFilter,
  type QueuedReport,
} from '@/features/admin/api';
import { AdminPage, Card, Empty, Pill } from '@/features/admin/ui';
import { formatAge, formatDistance, formatPrice } from '@/features/stations/format';
import { useFuelTypes } from '@/features/stations/use-stations';

const filters = [
  { value: 'flagged', label: 'Unusual' },
  { value: 'pending', label: 'All waiting' },
  { value: 'decided', label: 'Decided' },
] as const;

export default function AdminReports() {
  const params = useLocalSearchParams<{ filter?: QueueFilter }>();
  const [filter, setFilter] = useState<QueueFilter>(params.filter ?? 'flagged');
  const queue = useReportQueue(filter);

  return (
    <AdminPage
      title="Price reports"
      error={queue.error ? adminErrorMessage(queue.error) : null}
      onRefresh={() => queue.refetch()}
      refreshing={queue.isRefetching}>
      <Segmented label="Show" value={filter} options={filters} onChange={setFilter} />
      <Text className="text-sm text-ink-muted">
        {filter === 'decided'
          ? 'Prices decided in the last 7 days, by drivers, the auto-verify job or admins.'
          : 'Confirming a price awards the reporter’s points. Voters who agreed with your decision earn theirs too.'}
      </Text>
      {queue.isPending ? <Empty>Loading…</Empty> : null}
      {queue.data?.length === 0 ? (
        <Empty>{filter === 'decided' ? 'Nothing decided this week.' : 'Nothing waiting. 🎉'}</Empty>
      ) : null}
      {queue.data?.map((report) => (
        <ReportCard key={report.id} report={report} />
      ))}
    </AdminPage>
  );
}

function ReportCard({ report }: { report: QueuedReport }) {
  const fuelTypes = useFuelTypes();
  const decide = useDecideReport();
  const showToast = useToast((s) => s.show);
  const fuel =
    fuelTypes.data?.find((f) => f.code === report.fuel_type)?.short_label ?? report.fuel_type;
  const waiting = report.status === 'pending';

  const run = (outcome: 'verified' | 'rejected') =>
    decide.mutate(
      { id: report.id, outcome },
      {
        onSuccess: () => showToast(outcome === 'verified' ? 'Price confirmed.' : 'Price rejected.'),
        onError: (e) => showToast(adminErrorMessage(e), 'error'),
      },
    );

  return (
    <Card>
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="font-black text-xl text-ink">
          {fuel} {formatPrice(report.price)}
        </Text>
        {report.flagged ? <Pill label="Unusual" tone="warn" /> : null}
        {!waiting ? (
          <Pill
            label={report.status === 'verified' ? 'Confirmed' : 'Rejected'}
            tone={report.status === 'verified' ? 'good' : 'danger'}
          />
        ) : null}
      </View>
      <Link href={{ pathname: '/station/[id]', params: { id: report.station_id } }}>
        <Text className="font-semibold text-base text-emphasis underline">
          {report.station_name}
        </Text>
      </Link>
      {report.flag_reason ? <Text className="text-sm text-ink">{report.flag_reason}</Text> : null}
      <Text className="text-sm text-ink-muted">
        {formatAge(report.reported_at)}
        {report.distance_m != null
          ? ` · sent ${formatDistance(report.distance_m)} from the station`
          : ''}
        {` · ${report.confirms} correct, ${report.disputes} wrong`}
      </Text>
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="text-sm text-ink">
          {report.reporter_username ? `@${report.reporter_username}` : 'Deleted account'}
        </Text>
        <Text className="text-xs text-ink-muted">
          {report.reporter_verified} confirmed · {report.reporter_rejected} rejected
        </Text>
        {report.reporter_banned ? <Pill label="Banned" tone="danger" /> : null}
      </View>
      {waiting ? (
        <View className="flex-row gap-2 pt-1">
          <Button
            label="Confirm"
            variant="secondary"
            className="flex-1"
            loading={decide.isPending && decide.variables?.outcome === 'verified'}
            disabled={decide.isPending}
            onPress={() => run('verified')}
          />
          <Button
            label="Reject"
            variant="outline"
            className="flex-1"
            loading={decide.isPending && decide.variables?.outcome === 'rejected'}
            disabled={decide.isPending}
            onPress={() => run('rejected')}
          />
        </View>
      ) : null}
    </Card>
  );
}
