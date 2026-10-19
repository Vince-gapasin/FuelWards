import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text, View } from 'react-native';

import { AuthScreen } from '@/components/auth-screen';
import { Button } from '@/components/button';
import { Checkbox } from '@/components/checkbox';
import { Notice } from '@/components/notice';
import { TextField } from '@/components/text-field';
import { TextLink } from '@/components/text-link';
import { setStayLoggedIn } from '@/features/auth/auth-store';
import { authErrorMessage } from '@/features/auth/errors';
import { notConfiguredMessage } from '@/features/auth/not-configured';
import { loginSchema, type LoginValues } from '@/features/auth/schemas';
import { supabase, supabaseConfigured } from '@/lib/supabase';

const notices = {
  'password-changed': 'Password changed! Log in with your new password.',
} as const;

// Figma: "Login" (9:106) and "Password Changed (relog)" (9:465). "Account Created (Login)" (9:251)
// is replaced by the verify-email code screen, which signs the new user straight in.
export default function Login() {
  const { notice, email } = useLocalSearchParams<{
    notice?: keyof typeof notices;
    email?: string;
  }>();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: email ?? '', password: '', stayLoggedIn: true },
  });

  const onSubmit = handleSubmit(async ({ email, password, stayLoggedIn }) => {
    setFormError(null);
    if (!supabaseConfigured) return setFormError(notConfiguredMessage);
    try {
      await setStayLoggedIn(stayLoggedIn);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error?.code === 'email_not_confirmed') {
        await supabase.auth.resend({ type: 'signup', email });
        router.push({ pathname: '/verify-email', params: { email } });
        return;
      }
      if (error) setFormError(authErrorMessage(error));
      // On success the auth listener updates the session and the router opens the app.
    } catch (e) {
      setFormError(authErrorMessage(e));
    }
  });

  const banner = notice && notices[notice];

  return (
    <AuthScreen backTo="/welcome">
      {banner ? <Notice tone="success" message={banner} /> : null}
      {formError ? <Notice tone="error" message={formError} /> : null}

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
            returnKeyType="next"
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
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => onSubmit()}
          />
        )}
      />
      <Controller
        control={control}
        name="stayLoggedIn"
        render={({ field }) => (
          <Checkbox checked={field.value} onChange={field.onChange} label="Stay logged in" />
        )}
      />

      <Button label="Log in" onPress={onSubmit} loading={isSubmitting} className="mt-2" />

      <View className="items-center gap-3">
        <TextLink href="/forgot-password" label="Forgot password?" />
        <View className="flex-row items-center gap-1">
          <Text className="text-sm text-ink-muted">New to FuelWards?</Text>
          <TextLink href="/sign-up" label="Create an account" replace />
        </View>
      </View>
    </AuthScreen>
  );
}
