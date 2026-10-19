import { LocationRequiredError, reportErrorMessage } from '@/features/reports/errors';
import { parsePriceInputs } from '@/features/reports/prices';

describe('parsePriceInputs', () => {
  it('keeps filled-in prices and skips empty fields', () => {
    expect(parsePriceInputs({ GAS91: '60.80', GAS95: '', DIESEL: ' 57.1 ' })).toEqual({
      prices: { GAS91: 60.8, DIESEL: 57.1 },
      errors: {},
    });
  });

  it('accepts a peso sign and a decimal comma', () => {
    expect(parsePriceInputs({ GAS91: '₱ 61,25' }).prices).toEqual({ GAS91: 61.25 });
  });

  it.each([
    ['letters', '6O.80', 'Use a price like 61.25'],
    ['three decimals', '60.805', 'Use a price like 61.25'],
    ['too low', '15', 'Must be between ₱20 and ₱300'],
    ['too high', '350', 'Must be between ₱20 and ₱300'],
  ])('rejects %s', (_label, input, message) => {
    expect(parsePriceInputs({ DIESEL: input })).toEqual({
      prices: {},
      errors: { DIESEL: message },
    });
  });
});

describe('reportErrorMessage', () => {
  const label = (code: string) => ({ DIESEL: 'Diesel', GAS91: 'Reg 91' })[code] ?? code;

  it('tells the reporter how far away they are', () => {
    expect(reportErrorMessage({ message: 'too_far', details: '1234' })).toBe(
      'You need to be at the station. You’re about 1.2 km away.',
    );
  });

  it('names the fuel in duplicate and range errors', () => {
    expect(reportErrorMessage({ message: 'already_reported', details: 'DIESEL' }, label)).toBe(
      'You already reported Diesel here recently.',
    );
    expect(reportErrorMessage({ message: 'price_out_of_range', details: 'GAS91' }, label)).toBe(
      'The Reg 91 price doesn’t look right.',
    );
  });

  it('explains vote errors', () => {
    expect(reportErrorMessage({ message: 'own_report' })).toBe(
      'You can’t confirm your own report.',
    );
    expect(reportErrorMessage({ message: 'already_voted' })).toBe(
      'You already voted on this price.',
    );
  });

  it('asks for location when it is missing', () => {
    expect(reportErrorMessage(new LocationRequiredError())).toBe(
      'Allow location access so we can confirm you’re at the station.',
    );
  });

  it('does not leak unknown errors', () => {
    expect(reportErrorMessage({ message: 'relation "x" does not exist' })).toBe(
      'Something went wrong. Please try again.',
    );
  });
});
