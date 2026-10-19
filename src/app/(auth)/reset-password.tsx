import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AuthScreen } from '@/components/auth-screen';
import { Button } from '@/components/button';
import { Notice } from '@/components/notice';
import { TextField } from '@/components/text-field';
import { useAuthStore } from '@/features/auth/auth-store';
import { authErrorMessage } from '@/features/auth/errors';
import { resetPasswordSchema, type ResetPasswordValues } from '@/features/auth/schemas';
import { useCooldown } from '@/features/auth/use-cooldown';
import { supabase } from '@/lib/supabase';

// Figma: "Forgot Password (re)" (9:350). Title typo and red button fixed.
export default function ResetPassword() {
  const { t } = useTranslation();
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const setRecovering = useAuthStore((s) => s.setRecovering);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const cooldown = useCooldown(60);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { code: '', password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async ({ code, password }) => {
    setMessage(null);
    // Verifying the code signs the user in; stay on this screen until the password is saved.
    setRecovering(true);
    try {
      const verified = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
      if (verified.error) throw verified.error;

      const updated = await supabase.auth.updateUser({ password });
      if (updated.error) {
        await supabase.auth.signOut({ scope: 'local' });
        throw updated.error;
      }

      // Sign out everywhere so any old sessions stop working, then log in again (as in the prototype).
      await supabase.auth.signOut({ scope: 'global' });
      router.replace({ pathname: '/login', params: { notice: 'password-changed', email } });
    } catch (e) {
      setMessage({ tone: 'error', text: authErrorMessage(e) });
    } finally {
      setRecovering(false);
    }
  });

  const resend = async () => {
    setMessage(null);
    cooldown.start();
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setMessage(
      error
        ? { tone: 'error', text: authErrorMessage(error) }
        : { tone: 'success', text: t('auth.codeSent') },
    );
  };

  return (
    <AuthScreen
      backTo="/forgot-password"
      showLogo={false}
      title={t('auth.resetTitle')}
      subtitle={t('auth.resetSubtitle', { email: email || t('auth.yourEmail') })}>
      {message ? <Notice tone={message.tone} message={message.text} /> : null}
      <Controller
        control={control}
        name="code"
        render={({ field }) => (
          <TextField
            label={t('auth.code')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.code?.message}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <TextField
            label={t('auth.newPassword')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.password?.message}
            secure
            autoComplete="new-password"
            textContentType="newPassword"
          />
        )}
      />
      <Controller
        control={control}
        name="confirmPassword"
        render={({ field }) => (
          <TextField
            label={t('auth.retypeNewPassword')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.confirmPassword?.message}
            secure
            autoComplete="new-password"
            textContentType="newPassword"
            onSubmitEditing={() => onSubmit()}
          />
        )}
      />
      <Button label={t('auth.resetButton')} onPress={onSubmit} loading={isSubmitting} />
      <Pressable
        accessibilityRole="button"
        disabled={cooldown.left > 0}
        onPress={resend}
        className="items-center py-2">
        <Text
          className={`font-semibold text-sm ${cooldown.left > 0 ? 'text-ink-subtle' : 'text-action'}`}>
          {cooldown.left > 0
            ? t('auth.resendIn', { seconds: cooldown.left })
            : t('auth.resendCode')}
        </Text>
      </Pressable>
    </AuthScreen>
  );
}
