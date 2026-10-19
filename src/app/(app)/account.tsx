import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { loadLanguagePreference, setLanguagePreference, type LanguagePreference } from '@/i18n';

import { Button } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { Segmented } from '@/components/segmented';
import { useToast } from '@/components/toast';
import { useProfile } from '@/features/auth/use-profile';
import { usePointsHistory, useTiers } from '@/features/rewards/api';
import { formatDate, reasonLabel } from '@/features/rewards/format';
import { TierProgress } from '@/features/rewards/tier-progress';
import { queryPersister } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import { loadThemePreference, useThemePreference, type ThemePreference } from '@/theme/theme';

// Profile: name, tier, contribution stats, points history and account actions.
export default function Account() {
  const { t } = useTranslation();
  const { data } = useProfile();
  const tiers = useTiers();
  const history = usePointsHistory();
  const queryClient = useQueryClient();
  const showToast = useToast((s) => s.show);
  const [signingOut, setSigningOut] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [themeChoice, setThemeChoice] = useState<ThemePreference>('system');
  const { setPreference } = useThemePreference();
  const [languageChoice, setLanguageChoice] = useState<LanguagePreference>('system');
  useEffect(() => {
    loadThemePreference().then(setThemeChoice);
    loadLanguagePreference().then(setLanguageChoice);
  }, []);

  const profile = data?.profile;
  const stats = data?.stats;

  const signOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    queryClient.clear();
    // Saved offline data belongs to this account; don't leave it on a shared device.
    await queryPersister.removeClient();
  };

  const saveName = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: name.trim() || null })
      .eq('id', profile.id);
    setSaving(false);
    if (error) return showToast(t('profile.saveFailed'), 'error');
    setEditing(false);
    await queryClient.invalidateQueries({ queryKey: ['profile'] });
    queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader title={t('profile.title')} />
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
                  accessibilityLabel={t('profile.displayName')}
                  value={name}
                  onChangeText={setName}
                  maxLength={40}
                  autoFocus
                  placeholder={profile?.username}
                  className="h-11 flex-1 rounded-lg border border-line-strong px-3 font-sans text-base text-ink outline-none"
                />
                <Button
                  label={t('common.save')}
                  className="h-11"
                  onPress={saveName}
                  loading={saving}
                />
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('profile.editName')}
                onPress={() => {
                  setName(profile?.display_name ?? '');
                  setEditing(true);
                }}
                className="flex-row items-center gap-1.5">
                <Text accessibilityRole="header" className="font-bold text-2xl text-ink">
                  {profile?.display_name || profile?.username || ' '}
                </Text>
                <Ionicons name="pencil" size={16} className="text-ink-muted" />
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
                [t('profile.stats.points'), stats.balance],
                [t('profile.stats.pending'), stats.pending],
                [t('profile.stats.confirmed'), stats.verified_reports],
                [t('profile.stats.votes'), stats.votes],
              ].map(([label, value]) => (
                <View key={label} className="min-w-[45%] flex-1 rounded-2xl border border-line p-3">
                  <Text className="font-black text-2xl text-emphasis">{value}</Text>
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
                [t('profile.links.saved'), 'heart-outline', '/saved'],
                [t('profile.links.alerts'), 'notifications-outline', '/alerts'],
                [t('profile.links.rewards'), 'gift-outline', '/rewards'],
                [t('profile.links.vouchers'), 'ticket-outline', '/vouchers'],
                [t('profile.links.leaderboard'), 'trophy-outline', '/leaderboard'],
                [t('profile.links.privacy'), 'shield-checkmark-outline', '/privacy'],
              ] as const
            ).map(([label, icon, href], i) => (
              <Pressable
                key={label}
                accessibilityRole="link"
                onPress={() => router.push(href)}
                className={`flex-row items-center gap-3 px-4 py-3.5 active:bg-sky ${i > 0 ? 'border-t border-line' : ''}`}>
                <Ionicons name={icon} size={20} className="text-emphasis" />
                <Text className="flex-1 text-base text-ink">{label}</Text>
                <Ionicons name="chevron-forward" size={18} className="text-ink-subtle" />
              </Pressable>
            ))}
          </View>

          <Segmented
            label={t('profile.appearance')}
            value={themeChoice}
            options={[
              { value: 'system', label: t('profile.system') },
              { value: 'light', label: t('profile.light') },
              { value: 'dark', label: t('profile.dark') },
            ]}
            onChange={(choice) => {
              setThemeChoice(choice);
              setPreference(choice);
            }}
          />

          <Segmented
            label={t('profile.language')}
            value={languageChoice}
            options={[
              { value: 'system', label: t('profile.system') },
              { value: 'en', label: 'English' },
              { value: 'fil', label: 'Filipino' },
            ]}
            onChange={(choice) => {
              setLanguageChoice(choice);
              setLanguagePreference(choice);
            }}
          />

          <View className="gap-2">
            <Text className="font-bold text-lg text-ink">{t('profile.history')}</Text>
            {history.data?.length === 0 ? (
              <Text className="text-sm text-ink-muted">{t('profile.historyEmpty')}</Text>
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

          <Button
            label={t('common.logOut')}
            variant="outline"
            onPress={signOut}
            loading={signingOut}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
