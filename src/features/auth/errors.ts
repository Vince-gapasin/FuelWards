import { isAuthError } from '@supabase/supabase-js';

import i18n from '@/i18n';

// Supabase Auth error code → translation key.
const messages: Record<string, string> = {
  invalid_credentials: 'auth.errors.invalidCredentials',
  email_not_confirmed: 'auth.errors.emailNotConfirmed',
  user_already_exists: 'auth.errors.emailExists',
  email_exists: 'auth.errors.emailExists',
  weak_password: 'auth.errors.weakPassword',
  same_password: 'auth.errors.samePassword',
  otp_expired: 'auth.errors.codeExpired',
  over_email_send_rate_limit: 'auth.errors.tooManyEmails',
  over_request_rate_limit: 'auth.errors.tooManyAttempts',
  email_address_invalid: 'auth.errors.invalidEmail',
  signup_disabled: 'auth.errors.signupDisabled',
  user_banned: 'auth.errors.banned',
};

/** Turns a Supabase Auth error (or anything thrown) into a message for the user. */
export function authErrorMessage(error: unknown): string {
  const t = i18n.t.bind(i18n);
  if (isAuthError(error)) {
    if (error.code && messages[error.code]) return t(messages[error.code]);
    // The profile trigger rejects a username taken between the availability check and sign-up.
    if (/database error saving new user/i.test(error.message)) {
      return t('auth.errors.usernameJustTaken');
    }
    if (error.status === 0 || /fetch/i.test(error.message)) {
      return t('common.networkError');
    }
    return error.message;
  }
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return t('common.networkError');
  }
  return t('common.genericError');
}
