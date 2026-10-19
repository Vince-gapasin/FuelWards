import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text, View } from 'react-native';

import { AuthScreen } from '@/components/auth-screen';
import { Button } from '@/components/button';
import { Checkbox } from '@/components/checkbox';
import { Notice } from '@/components/notice';
import { TextField } from '@/components/text-field';
import { TextLink } from '@/components/text-link';
import { authErrorMessage } from '@/features/auth/errors';
import { notConfiguredMessage } from '@/features/auth/not-configured';
import { signUpSchema, type SignUpValues } from '@/features/auth/schemas';
import { supabase, supabaseConfigured } from '@/lib/supabase';

// Figma: "Sign Up" (9:208). Adds the email address that password reset needs, and privacy consent.
export default function SignUp() {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptPrivacy: false,
    },
  });

  const onSubmit = handleSubmit(async ({ username, email, password }) => {
    setFormError(null);
    if (!supabaseConfigured) return setFormError(notConfiguredMessage);
    try {
      const { data: available, error: rpcError } = await supabase.rpc('username_available', {
        name: username,
      });
      if (rpcError) throw rpcError;
      if (!available) {
        setError('username', { message: 'That username is taken. Choose another one.' });
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username, privacy_accepted_at: new Date().toISOString() },
        },
      });
      if (error) return setFormError(authErrorMessage(error));

      // With email confirmation off, Supabase signs the user straight in and the router opens the app.
      if (data.session) return;

      // Supabase hides existing accounts by returning a user with no identities.
      if (data.user && data.user.identities?.length === 0) {
        setFormError('An account with this email already exists. Try logging in.');
        return;
      }
      router.replace({ pathname: '/verify-email', params: { email } });
    } catch (e) {
      setFormError(authErrorMessage(e));
    }
  });

  return (
    <AuthScreen backTo="/welcome">
      {formError ? <Notice tone="error" message={formError} /> : null}

      <Controller
        control={control}
        name="username"
        render={({ field }) => (
          <TextField
            label="Username"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.username?.message}
            autoComplete="username-new"
            textContentType="username"
            maxLength={20}
          />
        )}
      />
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <TextField
            label="Email"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.email?.message}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <TextField
            label="Password"
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
            label="Re-type password"
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
      <Controller
        control={control}
        name="acceptPrivacy"
        render={({ field }) => (
          <Checkbox
            checked={field.value}
            onChange={field.onChange}
            error={errors.acceptPrivacy?.message}
            label={
              <View className="flex-row flex-wrap items-center gap-1">
                <Text className="text-sm text-ink">I agree to the</Text>
                <TextLink href="/privacy" label="Privacy Notice" />
              </View>
            }
          />
        )}
      />

      <Button
        label="Sign Up"
        variant="secondary"
        onPress={onSubmit}
        loading={isSubmitting}
        className="mt-2"
      />

      <View className="flex-row items-center justify-center gap-1">
        <Text className="text-sm text-ink-muted">Already have an account?</Text>
        <TextLink href="/login" label="Log in" replace />
      </View>
    </AuthScreen>
  );
}
