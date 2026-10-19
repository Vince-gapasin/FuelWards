import * as Sentry from '@sentry/react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

/**
 * Crash reporting with Sentry (free Developer plan). Off unless EXPO_PUBLIC_SENTRY_DSN is set, and
 * off in development. Reports carry the error, app version and device model only: no IP address,
 * no location and no user details (sendDefaultPii is off).
 */
export function initMonitoring() {
  if (!dsn || __DEV__) return;
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
  });
}

export const withMonitoring = Sentry.wrap;
