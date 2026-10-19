import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { useToast } from '@/components/toast';
import { useProfile } from '@/features/auth/use-profile';
import { usePointsHistory, useTiers } from '@/features/rewards/api';
import { formatDate, reasonLabel } from '@/features/rewards/format';
import { TierProgress } from '@/features/rewards/tier-progress';
import { supabase } from '@/lib/supabase';

// Profile: name, tier, contribution stats, points history and account actions.
export default function Account() {
  const { data } = useProfile();
  const tiers = useTiers();
  const history = usePointsHistory();
  const queryClient = useQueryClient();
  const showToast = useToast((s) => s.show);
  const [signingOut, setSigningOut] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const profile = data?.profile;
  const stats = data?.stats;

  const signOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    queryClient.clear();
  };

  const saveName = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: name.trim() || null })
      .eq('id', profile.id);
    setSaving(false);
    if (error) return showToast('Couldn’t save your name. Try again.', 'error');
    setEditing(false);
    await queryClient.invalidateQueries({ queryKey: ['profile'] });
    queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScreenHeader title="Profile" />
      <ScrollView contentContainerClassName="px-5 py-5">
        <View className="w-full max-w-md gap-5 self-center">
          <View className="items-center gap-2">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-navy">
              <Text className="font-black text-3xl text-white">
                {(profile?.display_name || profile?.username || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            {editing ? (
              <View className="w-full flex-row items-center gap-2">
                <TextInput
                  accessibilityLabel="Display name"
                  value={name}
                  onChangeText={setName}
                  maxLength={40}
                  autoFocus
                  placeholder={profile?.username}
                  className="h-11 flex-1 rounded-lg border border-line-strong px-3 font-sans text-base text-ink outline-none"
                />
                <Button label="Save" className="h-11" onPress={saveName} loading={saving} />
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit display name"
                onPress={() => {
                  setName(profile?.display_name ?? '');
                  setEditing(true);
                }}
                className="flex-row items-center gap-1.5">
                <Text accessibilityRole="header" className="font-bold text-2xl text-ink">
                  {profile?.display_name || profile?.username || ' '}
                </Text>
                <Ionicons name="pencil" size={16} color="#5A5A5A" />
              </Pressable>
            )}
            {profile ? <Text className="text-sm text-ink-muted">@{profile.username}</Text> : null}
          </View>

          {stats && tiers.data ? (
            <View className="rounded-2xl bg-navy p-4">
              <TierProgress tier={stats.tier} lifetime={stats.lifetime} tiers={tiers.data} dark />
            </View>
          ) : null}

          {stats ? (
            <View className="flex-row flex-wrap gap-2">
              {[
                ['Points', stats.balance],
                ['Pending', stats.pending],
                ['Prices confirmed', stats.verified_reports],
                ['Votes', stats.votes],
              ].map(([label, value]) => (
                <View key={label} className="min-w-[45%] flex-1 rounded-2xl border border-line p-3">
                  <Text className="font-black text-2xl text-navy">{value}</Text>
                  <Text className="text-xs text-ink-muted">{label}</Text>
                </View>
              ))}
            </View>
          ) : (
            <ActivityIndicator color="#007BFF" />
          )}

          <View className="overflow-hidden rounded-2xl border border-line">
            {(
              [
                ['Rewards', 'gift-outline', '/rewards'],
                ['My vouchers', 'ticket-outline', '/vouchers'],
                ['Leaderboard', 'trophy-outline', '/leaderboard'],
                ['Privacy Notice', 'shield-checkmark-outline', '/privacy'],
              ] as const
            ).map(([label, icon, href], i) => (
              <Pressable
                key={label}
                accessibilityRole="link"
                onPress={() => router.push(href)}
                className={`flex-row items-center gap-3 px-4 py-3.5 active:bg-sky ${i > 0 ? 'border-t border-line' : ''}`}>
                <Ionicons name={icon} size={20} color="#011D39" />
                <Text className="flex-1 text-base text-ink">{label}</Text>
                <Ionicons name="chevron-forward" size={18} color="#B3B3B3" />
              </Pressable>
            ))}
          </View>

          <View className="gap-2">
            <Text className="font-bold text-lg text-ink">Points history</Text>
            {history.data?.length === 0 ? (
              <Text className="text-sm text-ink-muted">
                No points yet. Report a price or confirm one to start earning.
              </Text>
            ) : null}
            {history.data?.map((entry) => (
              <View
                key={entry.id}
                className="flex-row items-center justify-between border-b border-line/60 py-2">
                <View>
                  <Text className="text-sm text-ink">{reasonLabel(entry.reason)}</Text>
                  <Text className="text-xs text-ink-muted">{formatDate(entry.created_at)}</Text>
                </View>
                <Text
                  className={`font-bold text-sm ${entry.delta > 0 ? 'text-brand' : 'text-ink-muted'}`}>
                  {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                </Text>
              </View>
            ))}
          </View>

          <Button label="Log out" variant="outline" onPress={signOut} loading={signingOut} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
