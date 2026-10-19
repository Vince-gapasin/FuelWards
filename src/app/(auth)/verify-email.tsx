import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, Text } from 'react-native';

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
        : { tone: 'success', text: 'We sent a new code.' },
    );
  };

  return (
    <AuthScreen
      backTo="/login"
      showLogo={false}
      title="Check your email"
      subtitle={`Enter the 6-digit code we sent to ${email || 'your email'}.`}>
      {message ? <Notice tone={message.tone} message={message.text} /> : null}
      <Controller
        control={control}
        name="code"
        render={({ field }) => (
          <TextField
            label="Code"
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
      <Button label="Verify" onPress={onSubmit} loading={isSubmitting} />
      <Pressable
        accessibilityRole="button"
        disabled={cooldown.left > 0}
        onPress={resend}
        className="items-center py-2">
        <Text
          className={`font-semibold text-sm ${cooldown.left > 0 ? 'text-ink-subtle' : 'text-action'}`}>
          {cooldown.left > 0 ? `Resend code in ${cooldown.left}s` : 'Resend code'}
        </Text>
      </Pressable>
    </AuthScreen>
  );
}
