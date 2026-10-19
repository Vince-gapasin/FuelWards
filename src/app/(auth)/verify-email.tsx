import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AuthScreen } from '@/components/auth-screen';
import { Button } from '@/components/button';
import { Notice } from '@/components/notice';
import { TextField } from '@/components/text-field';
import { authErrorMessage } from '@/features/auth/errors';
import { verifyEmailSchema, type VerifyEmailValues } from '@/features/auth/schemas';
import { useCooldown } from '@/features/auth/use-cooldown';
import { supabase } from '@/lib/supabase';

// New screen: confirms the sign-up email with a 6-digit code (no links to open on the phone).
export default function VerifyEmail() {
  const { t } = useTranslation();
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const cooldown = useCooldown(60);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyEmailValues>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { code: '' },
  });

  const onSubmit = handleSubmit(async ({ code }) => {
    setMessage(null);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
      if (error) setMessage({ tone: 'error', text: authErrorMessage(error) });
      // On success the session arrives and the router opens the app.
    } catch (e) {
      setMessage({ tone: 'error', text: authErrorMessage(e) });
    }
  });

  const resend = async () => {
    setMessage(null);
    cooldown.start();
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setMessage(
      error
        ? { tone: 'error', text: authErrorMessage(error) }
        : { tone: 'success', text: t('auth.codeSent') },
    );
  };

  return (
    <AuthScreen
      backTo="/login"
      showLogo={false}
      title={t('auth.verifyTitle')}
      subtitle={t('auth.verifySubtitle', { email: email || t('auth.yourEmail') })}>
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
            onSubmitEditing={() => onSubmit()}
          />
        )}
      />
      <Button label={t('auth.verify')} onPress={onSubmit} loading={isSubmitting} />
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
