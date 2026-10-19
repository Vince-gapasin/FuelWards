import { formatDistance } from '@/features/stations/format';

type ServerError = { message?: string; details?: string | null; code?: string };

export class LocationRequiredError extends Error {
  constructor() {
    super('location_required');
  }
}

/** Message for a failed report or vote. Server rules raise short codes (see the price_reports migration). */
export function reportErrorMessage(
  error: unknown,
  fuelLabel: (code: string) => string = (c) => c,
): string {
  if (error instanceof LocationRequiredError) {
    return 'Allow location access so we can confirm you’re at the station.';
  }
  const e = (error ?? {}) as ServerError;
  const meters = Number(e.details);
  switch (e.message) {
    case 'too_far':
      return Number.isFinite(meters)
        ? `You need to be at the station. You’re about ${formatDistance(meters)} away.`
        : 'You need to be at the station.';
    case 'rate_limited':
      return 'You’ve sent a lot of reports this hour. Try again later.';
    case 'already_reported':
      return `You already reported ${fuelLabel(e.details ?? '')} here recently.`;
    case 'price_out_of_range':
      return `The ${fuelLabel(e.details ?? '')} price doesn’t look right.`;
    case 'unknown_fuel':
    case 'no_prices':
      return 'Enter at least one price.';
    case 'station_not_found':
      return 'This station isn’t available any more.';
    case 'not_signed_in':
      return 'Your session expired. Log in again.';
    case 'own_report':
      return 'You can’t confirm your own report.';
    case 'already_voted':
      return 'You already voted on this price.';
    case 'already_decided':
    case 'report_not_found':
      return 'This price was already confirmed or rejected.';
  }
  if (error instanceof TypeError || /fetch|network/i.test(e.message ?? '')) {
    return 'Can’t reach the server. Check your connection and try again.';
  }
  return 'Something went wrong. Please try again.';
}
