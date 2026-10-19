import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/button';
import { Logo } from '@/components/logo';
import { useAuthStore } from '@/features/auth/auth-store';
import { supabase } from '@/lib/supabase';

/**
 * Asks for privacy consent (RA 10173) before the app opens, for accounts that never gave it, for
 * example ones created outside the sign-up form. Sign-up records consent in the user's metadata
 * and profile, so most users never see this.
 */
export function ConsentGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.session?.user);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!user || user.user_metadata?.privacy_accepted_at) return children;

  const accept = async () => {
    setSaving(true);
    setFailed(false);
    const acceptedAt = new Date().toISOString();
    const profile = await supabase
      .from('profiles')
      .update({ privacy_accepted_at: acceptedAt })
      .eq('id', user.id);
    // Updating the metadata refreshes the session, which lets the app through.
    const meta = profile.error
      ? profile
      : await supabase.auth.updateUser({ data: { privacy_accepted_at: acceptedAt } });
    if (meta.error) {
      setSaving(false);
      setFailed(true);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="w-full max-w-md flex-1 items-center justify-center gap-5 self-center px-6">
        <Logo size={96} />
        <Text accessibilityRole="header" className="text-center font-bold text-2xl text-ink">
          {t('privacy.consentTitle')}
        </Text>
        <Text className="text-center text-base leading-6 text-ink-muted">
          {t('privacy.consentBody')}
        </Text>
        {failed ? (
          <Text accessibilityRole="alert" className="text-center text-sm text-critical">
            {t('privacy.consentFailed')}
          </Text>
        ) : null}
        <View className="w-full gap-3">
          <Button label={t('privacy.consentAccept')} onPress={accept} loading={saving} />
          <Button
            label={t('privacy.consentRead')}
            variant="outline"
            onPress={() => router.push('/privacy')}
          />
          <Button
            label={t('common.logOut')}
            variant="outline"
            onPress={() => supabase.auth.signOut()}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
