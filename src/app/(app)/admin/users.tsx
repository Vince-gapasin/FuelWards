import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { useToast } from '@/components/toast';
import { adminErrorMessage, useAdminUsers, useSetBan, type AdminUser } from '@/features/admin/api';
import { AdminPage, Card, Empty, Pill } from '@/features/admin/ui';
import { formatDate } from '@/features/rewards/format';

export default function AdminUsers() {
  const [search, setSearch] = useState('');
  const users = useAdminUsers(search.trim());

  return (
    <AdminPage
      title="Users"
      error={users.error ? adminErrorMessage(users.error) : null}
      onRefresh={() => users.refetch()}
      refreshing={users.isRefetching}>
      <TextInput
        accessibilityLabel="Search users by username or name"
        placeholder="Search by username or name"
        placeholderTextColor="#8A8A8A"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
        autoCorrect={false}
        className="h-12 rounded-xl border border-line-strong px-3 font-sans text-base text-ink outline-none"
      />
      <Text className="text-sm text-ink-muted">
        Banning rejects the user’s waiting prices and withdraws their votes. They keep their account
        but can’t report, vote, set alerts or redeem until the ban is lifted.
      </Text>
      {users.isPending ? <Empty>Loading…</Empty> : null}
      {users.data?.length === 0 ? <Empty>No users match.</Empty> : null}
      {users.data?.map((user) => (
        <UserCard key={user.id} user={user} />
      ))}
    </AdminPage>
  );
}

function UserCard({ user }: { user: AdminUser }) {
  const setBan = useSetBan();
  const showToast = useToast((s) => s.show);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const banned = Boolean(user.banned_at);

  const submit = (ban: boolean) =>
    setBan.mutate(
      { id: user.id, banned: ban, reason: reason.trim() },
      {
        onSuccess: () => {
          setConfirming(false);
          setReason('');
          showToast(
            ban ? `@${user.username} is banned.` : `@${user.username} can contribute again.`,
          );
        },
        onError: (e) => showToast(adminErrorMessage(e), 'error'),
      },
    );

  return (
    <Card>
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="font-bold text-base text-ink">@{user.username}</Text>
        {user.display_name ? (
          <Text className="text-sm text-ink-muted">{user.display_name}</Text>
        ) : null}
        {user.role === 'admin' ? <Pill label="Admin" tone="info" /> : null}
        {banned ? <Pill label="Banned" tone="danger" /> : null}
      </View>
      <Text className="text-sm text-ink-muted">
        Joined {formatDate(user.created_at)} · {user.balance} points · {user.verified_reports}{' '}
        confirmed, {user.rejected_reports} rejected, {user.pending_reports} waiting
      </Text>
      {banned ? (
        <Text className="text-sm text-ink">
          Banned {formatDate(user.banned_at!)}
          {user.ban_reason ? `: ${user.ban_reason}` : ''}
        </Text>
      ) : null}

      {user.role === 'admin' ? null : banned ? (
        <Button
          label="Lift ban"
          variant="outline"
          loading={setBan.isPending}
          onPress={() => submit(false)}
        />
      ) : confirming ? (
        <View className="gap-2">
          <TextInput
            accessibilityLabel="Reason for the ban"
            placeholder="Reason (kept in the activity log)"
            placeholderTextColor="#8A8A8A"
            value={reason}
            onChangeText={setReason}
            maxLength={200}
            autoFocus
            className="h-12 rounded-xl border border-line-strong px-3 font-sans text-base text-ink outline-none"
          />
          <View className="flex-row gap-2">
            <Button
              label="Ban user"
              variant="danger"
              className="flex-1"
              loading={setBan.isPending}
              onPress={() => submit(true)}
            />
            <Button
              label="Cancel"
              variant="outline"
              className="flex-1"
              onPress={() => setConfirming(false)}
            />
          </View>
        </View>
      ) : (
        <Button label="Ban…" variant="outline" onPress={() => setConfirming(true)} />
      )}
    </Card>
  );
}
