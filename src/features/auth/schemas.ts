import { z } from 'zod';

// Matches supabase/config.toml: minimum_password_length = 8, password_requirements = letters_digits.
const password = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .regex(/[A-Za-z]/, 'Include at least one letter.')
  .regex(/\d/, 'Include at least one number.');

const email = z
  .string()
  .trim()
  .min(1, 'Enter your email address.')
  .pipe(z.email('Enter a valid email address.'));

// Matches the profiles.username check constraint.
export const username = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_]{3,20}$/, 'Use 3–20 letters, numbers or underscores.');

const code = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6-digit code from the email.');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.'),
  stayLoggedIn: z.boolean(),
});

export const signUpSchema = z
  .object({
    username,
    email,
    password,
    confirmPassword: z.string(),
    acceptPrivacy: z.boolean().refine((v) => v, 'You need to accept the Privacy Notice.'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

export const verifyEmailSchema = z.object({ code });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ code, password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
export type VerifyEmailValues = z.infer<typeof verifyEmailSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
