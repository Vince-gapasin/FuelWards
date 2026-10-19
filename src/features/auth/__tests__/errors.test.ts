import { AuthApiError } from '@supabase/supabase-js';

import { authErrorMessage } from '@/features/auth/errors';

describe('authErrorMessage', () => {
  it('maps known Supabase error codes to friendly text', () => {
    expect(
      authErrorMessage(new AuthApiError('Invalid login credentials', 400, 'invalid_credentials')),
    ).toBe('Wrong email or password.');
    expect(
      authErrorMessage(new AuthApiError('Token has expired or is invalid', 403, 'otp_expired')),
    ).toBe('That code is wrong or has expired. Request a new one.');
  });

  it('explains a username taken during sign-up', () => {
    expect(
      authErrorMessage(
        new AuthApiError('Database error saving new user', 500, 'unexpected_failure'),
      ),
    ).toBe('That username was just taken. Choose another one.');
  });

  it('falls back to the server message for unknown auth errors', () => {
    expect(authErrorMessage(new AuthApiError('Something specific', 400, 'validation_failed'))).toBe(
      'Something specific',
    );
  });

  it('reports network failures', () => {
    expect(authErrorMessage(new TypeError('Failed to fetch'))).toBe(
      'Can’t reach the server. Check your connection and try again.',
    );
  });

  it('never leaks unknown errors', () => {
    expect(authErrorMessage(new Error('stack trace details'))).toBe(
      'Something went wrong. Please try again.',
    );
  });
});
