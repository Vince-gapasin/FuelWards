import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { AuthScreen } from '@/components/auth-screen';
import { Button } from '@/components/button';
import { Notice } from '@/components/notice';
import { TextField } from '@/components/text-field';
import { authErrorMessage } from '@/features/auth/errors';
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/features/auth/schemas';
import { supabase, supabaseConfigured } from '@/lib/supabase';

// Figma: "Forgot Password" (9:299). Back now returns to Login, not Landing.
export default function ForgotPassword() {
  const { t } = useTranslation();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null);
    if (!supabaseConfigured) return setFormError(t('auth.notConfigured'));
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) return setFormError(authErrorMessage(error));
      router.push({ pathname: '/reset-password', params: { email } });
    } catch (e) {
      setFormError(authErrorMessage(e));
    }
  });

  return (
    <AuthScreen
      backTo="/login"
      showLogo={false}
      title={t('auth.forgotTitle')}
      subtitle={t('auth.forgotSubtitle')}>
      {formError ? <Notice tone="error" message={formError} /> : null}
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <TextField
            label={t('auth.emailAddress')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.email?.message}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            onSubmitEditing={() => onSubmit()}
          />
        )}
      />
      <Button label={t('auth.sendCode')} onPress={onSubmit} loading={isSubmitting} />
    </AuthScreen>
  );
}
