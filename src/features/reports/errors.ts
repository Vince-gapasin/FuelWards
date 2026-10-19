import { formatDistance } from '@/features/stations/format';
import i18n from '@/i18n';

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
  const t = i18n.t.bind(i18n);
  if (error instanceof LocationRequiredError) return t('report.errors.location');
  const e = (error ?? {}) as ServerError;
  const meters = Number(e.details);
  const fuel = fuelLabel(e.details ?? '');
  switch (e.message) {
    case 'too_far':
      return Number.isFinite(meters)
        ? t('report.errors.tooFarDistance', { distance: formatDistance(meters) })
        : t('report.errors.tooFar');
    case 'rate_limited':
      return t('report.errors.rateLimited');
    case 'already_reported':
      return t('report.errors.alreadyReported', { fuel });
    case 'price_out_of_range':
      return t('report.errors.priceOutOfRange', { fuel });
    case 'unknown_fuel':
    case 'no_prices':
      return t('report.errors.noPrices');
    case 'station_not_found':
      return t('report.errors.stationGone');
    case 'not_signed_in':
      return t('common.sessionExpired');
    case 'banned':
      return t('common.banned');
    case 'own_report':
      return t('report.errors.ownReport');
    case 'already_voted':
      return t('report.errors.alreadyVoted');
    case 'already_decided':
    case 'report_not_found':
      return t('report.errors.decided');
  }
  if (error instanceof TypeError || /fetch|network/i.test(e.message ?? '')) {
    return t('common.networkError');
  }
  return t('common.genericError');
}
