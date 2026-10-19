import { useState } from 'react';
import { Switch, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { useToast } from '@/components/toast';
import {
  adminErrorMessage,
  useAdminRewards,
  useSaveReward,
  type AdminReward,
} from '@/features/admin/api';
import { AdminPage, Card, Empty, Pill } from '@/features/admin/ui';

const input =
  'h-12 rounded-xl border border-line-strong px-3 font-sans text-base text-ink outline-none';

export default function AdminRewards() {
  const rewards = useAdminRewards();
  const [adding, setAdding] = useState(false);

  return (
    <AdminPage
      title="Rewards"
      error={rewards.error ? adminErrorMessage(rewards.error) : null}
      onRefresh={() => rewards.refetch()}
      refreshing={rewards.isRefetching}>
      <Text className="text-sm text-ink-muted">
        Turning a reward off hides it from the catalog. Vouchers already issued for it stay valid.
        Leave stock blank for unlimited.
      </Text>
      {adding ? (
        <RewardForm onDone={() => setAdding(false)} />
      ) : (
        <Button label="Add a reward" onPress={() => setAdding(true)} />
      )}
      {rewards.isPending ? <Empty>Loading…</Empty> : null}
      {rewards.data?.length === 0 ? <Empty>No rewards yet.</Empty> : null}
      {rewards.data?.map((reward) => (
        <RewardCard key={reward.id} reward={reward} />
      ))}
    </AdminPage>
  );
}

function RewardCard({ reward }: { reward: AdminReward }) {
  const save = useSaveReward();
  const showToast = useToast((s) => s.show);
  const [editing, setEditing] = useState(false);

  if (editing) return <RewardForm reward={reward} onDone={() => setEditing(false)} />;

  return (
    <Card>
      <View className="flex-row items-start gap-3">
        <View className="flex-1 gap-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="font-bold text-base text-ink">{reward.title}</Text>
            {reward.is_active ? null : <Pill label="Off" tone="danger" />}
          </View>
          <Text className="text-sm text-ink-muted">
            {[
              reward.partner,
              `${reward.cost_points} points`,
              reward.stock == null ? 'unlimited' : `${reward.stock} left`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {reward.description ? (
            <Text className="text-sm text-ink">{reward.description}</Text>
          ) : null}
        </View>
        <Switch
          accessibilityLabel={`Offer ${reward.title}`}
          value={reward.is_active}
          disabled={save.isPending}
          onValueChange={(on) =>
            save.mutate(
              { id: reward.id, is_active: on },
              {
                onSuccess: () => showToast(on ? 'Reward is in the catalog.' : 'Reward turned off.'),
                onError: (e) => showToast(adminErrorMessage(e), 'error'),
              },
            )
          }
        />
      </View>
      <Button label="Edit" variant="outline" onPress={() => setEditing(true)} />
    </Card>
  );
}

function RewardForm({ reward, onDone }: { reward?: AdminReward; onDone: () => void }) {
  const save = useSaveReward();
  const showToast = useToast((s) => s.show);
  const [title, setTitle] = useState(reward?.title ?? '');
  const [partner, setPartner] = useState(reward?.partner ?? '');
  const [description, setDescription] = useState(reward?.description ?? '');
  const [cost, setCost] = useState(reward ? String(reward.cost_points) : '');
  const [stock, setStock] = useState(reward?.stock == null ? '' : String(reward.stock));
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const costValue = Number(cost);
    const stockValue = stock.trim() === '' ? null : Number(stock);
    if (!title.trim()) return setError('Give the reward a title.');
    if (!Number.isInteger(costValue) || costValue <= 0) {
      return setError('Points must be a whole number above 0.');
    }
    if (stockValue !== null && (!Number.isInteger(stockValue) || stockValue < 0)) {
      return setError('Stock must be a whole number, or blank for unlimited.');
    }
    setError(null);
    save.mutate(
      {
        id: reward?.id,
        title: title.trim(),
        partner: partner.trim() || null,
        description: description.trim() || null,
        cost_points: costValue,
        stock: stockValue,
      },
      {
        onSuccess: () => {
          showToast(reward ? 'Reward saved.' : 'Reward added.');
          onDone();
        },
        onError: (e) => setError(adminErrorMessage(e)),
      },
    );
  };

  return (
    <Card>
      <Text className="font-bold text-base text-ink">{reward ? 'Edit reward' : 'New reward'}</Text>
      <TextInput
        accessibilityLabel="Title"
        placeholder="Title, e.g. ₱50 fuel voucher"
        placeholderTextColor="#8A8A8A"
        value={title}
        onChangeText={setTitle}
        maxLength={80}
        className={input}
      />
      <TextInput
        accessibilityLabel="Partner"
        placeholder="Partner, e.g. Petron"
        placeholderTextColor="#8A8A8A"
        value={partner}
        onChangeText={setPartner}
        maxLength={60}
        className={input}
      />
      <TextInput
        accessibilityLabel="Description"
        placeholder="Description (optional)"
        placeholderTextColor="#8A8A8A"
        value={description}
        onChangeText={setDescription}
        maxLength={200}
        className={input}
      />
      <View className="flex-row gap-2">
        <TextInput
          accessibilityLabel="Points cost"
          placeholder="Points"
          placeholderTextColor="#8A8A8A"
          value={cost}
          onChangeText={setCost}
          keyboardType="number-pad"
          className={`flex-1 ${input}`}
        />
        <TextInput
          accessibilityLabel="Stock, blank for unlimited"
          placeholder="Stock (blank = unlimited)"
          placeholderTextColor="#8A8A8A"
          value={stock}
          onChangeText={setStock}
          keyboardType="number-pad"
          className={`flex-1 ${input}`}
        />
      </View>
      {error ? (
        <Text accessibilityRole="alert" className="text-sm text-critical">
          {error}
        </Text>
      ) : null}
      <View className="flex-row gap-2">
        <Button label="Save" className="flex-1" loading={save.isPending} onPress={submit} />
        <Button label="Cancel" variant="outline" className="flex-1" onPress={onDone} />
      </View>
    </Card>
  );
}
