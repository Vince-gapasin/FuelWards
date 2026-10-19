// Matches the server check in submit_price_report (price > 20 and < 300).
export const MIN_PRICE = 20;
export const MAX_PRICE = 300;

export type ParsedPrices = {
  /** Fuel code → price, only for fields the user filled in. */
  prices: Record<string, number>;
  /** Fuel code → message, for fields that are filled in but invalid. */
  errors: Record<string, string>;
};

/** Turns the form's text fields into prices. Empty fields are skipped, not errors. */
export function parsePriceInputs(values: Record<string, string>): ParsedPrices {
  const prices: Record<string, number> = {};
  const errors: Record<string, string> = {};
  for (const [code, raw] of Object.entries(values)) {
    const text = raw.trim().replace(/^₱\s*/, '').replace(',', '.');
    if (!text) continue;
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) {
      errors[code] = 'Use a price like 61.25';
      continue;
    }
    const price = Number(text);
    if (price <= MIN_PRICE || price >= MAX_PRICE) {
      errors[code] = `Must be between ₱${MIN_PRICE} and ₱${MAX_PRICE}`;
      continue;
    }
    prices[code] = price;
  }
  return { prices, errors };
}
