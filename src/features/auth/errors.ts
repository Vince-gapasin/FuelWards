import { isAuthError } from '@supabase/supabase-js';

const messages: Record<string, string> = {
  invalid_credentials: 'Wrong email or password.',
  email_not_confirmed: 'Confirm your email first. We sent you a 6-digit code.',
  user_already_exists: 'An account with this email already exists. Try logging in.',
  email_exists: 'An account with this email already exists. Try logging in.',
  weak_password: 'Choose a stronger password: at least 8 characters with letters and numbers.',
  same_password: 'Your new password must be different from the old one.',
  otp_expired: 'That code is wrong or has expired. Request a new one.',
  over_email_send_rate_limit: 'Too many emails sent. Wait a few minutes and try again.',
  over_request_rate_limit: 'Too many attempts. Wait a few minutes and try again.',
  email_address_invalid: 'Enter a valid email address.',
  signup_disabled: 'Sign-ups are closed right now.',
  user_banned: 'This account has been suspended.',
};

/** Turns a Supabase Auth error (or anything thrown) into a message for the user. */
export function authErrorMessage(error: unknown): string {
  if (isAuthError(error)) {
    if (error.code && messages[error.code]) return messages[error.code];
    // The profile trigger rejects a username taken between the availability check and sign-up.
    if (/database error saving new user/i.test(error.message)) {
      return 'That username was just taken. Choose another one.';
    }
    if (error.status === 0 || /fetch/i.test(error.message)) {
      return 'Can’t reach the server. Check your connection and try again.';
    }
    return error.message;
  }
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return 'Can’t reach the server. Check your connection and try again.';
  }
  return 'Something went wrong. Please try again.';
}
