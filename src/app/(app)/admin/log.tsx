import { Text, View } from 'react-native';

import { adminErrorMessage, useAuditLog } from '@/features/admin/api';
import { describeAction } from '@/features/admin/format';
import { AdminPage, Card, Empty } from '@/features/admin/ui';
import { formatAge } from '@/features/stations/format';

function summary(detail: Record<string, unknown> | null): string | null {
  if (!detail) return null;
  if (typeof detail.outcome === 'string')
    return detail.outcome === 'verified' ? 'Confirmed' : 'Rejected';
  if (typeof detail.reason === 'string' && detail.reason) return `Reason: ${detail.reason}`;
  const after = detail.after as Record<string, unknown> | undefined;
  const before = detail.before as Record<string, unknown> | undefined;
  if (after && before) {
    const changed = Object.keys(after).filter(
      (k) => JSON.stringify(after[k]) !== JSON.stringify(before[k]),
    );
    return (
      changed.map((k) => `${k}: ${String(before[k])} → ${String(after[k])}`).join(', ') || null
    );
  }
  const name = detail.name ?? detail.title ?? detail.fuel_type;
  return typeof name === 'string' ? name : null;
}

export default function AdminLog() {
  const log = useAuditLog();
  return (
    <AdminPage
      title="Activity log"
      error={log.error ? adminErrorMessage(log.error) : null}
      onRefresh={() => log.refetch()}
      refreshing={log.isRefetching}>
      <Text className="text-sm text-ink-muted">
        The latest 100 admin actions. The log can’t be edited.
      </Text>
      {log.isPending ? <Empty>Loading…</Empty> : null}
      {log.data?.length === 0 ? <Empty>No admin actions yet.</Empty> : null}
      {log.data?.length ? (
        <Card className="gap-0 p-0">
          {log.data.map((entry, i) => (
            <View
              key={entry.id}
              className={`gap-0.5 px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
              <Text className="text-sm text-ink">
                <Text className="font-semibold">@{entry.admin_username ?? 'deleted'}</Text>{' '}
                {describeAction(entry.action, entry.target_table)}
              </Text>
              {summary(entry.detail) ? (
                <Text className="text-xs text-ink-muted" numberOfLines={2}>
                  {summary(entry.detail)}
                </Text>
              ) : null}
              <Text className="text-xs text-ink-subtle">{formatAge(entry.created_at)}</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </AdminPage>
  );
}
