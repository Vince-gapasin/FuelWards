import { z } from 'zod';

import i18n from '@/i18n';

// Messages are looked up when validation runs, so they follow the current language.
const msg = (key: string) => ({ error: () => i18n.t(key) });

// Matches supabase/config.toml: minimum_password_length = 8, password_requirements = letters_digits.
const password = z
  .string()
  .min(8, msg('validation.passwordLength'))
  .regex(/[A-Za-z]/, msg('validation.passwordLetter'))
  .regex(/\d/, msg('validation.passwordNumber'));

const email = z
  .string()
  .trim()
  .min(1, msg('validation.emailRequired'))
  .pipe(z.email(msg('validation.emailInvalid')));

// Matches the profiles.username check constraint.
export const username = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_]{3,20}$/, msg('validation.usernameFormat'));

const code = z
  .string()
  .trim()
  .regex(/^\d{6}$/, msg('validation.code'));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, msg('validation.passwordRequired')),
  stayLoggedIn: z.boolean(),
});

export const signUpSchema = z
  .object({
    username,
    email,
    password,
    confirmPassword: z.string(),
    acceptPrivacy: z.boolean().refine((v) => v, msg('validation.acceptPrivacy')),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    ...msg('validation.passwordsMismatch'),
  });

export const verifyEmailSchema = z.object({ code });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ code, password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    ...msg('validation.passwordsMismatch'),
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
export type VerifyEmailValues = z.infer<typeof verifyEmailSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
