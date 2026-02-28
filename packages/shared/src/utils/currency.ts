// packages/shared/src/utils/currency.ts
// Utility functions for handling monetary values
// RULE: All amounts are in cents internally. Only format at display time.

/**
 * Formats a cent value into a display string.
 * e.g. 1050 -> "$10.50"
 *
 * BUG 1 (CRITICAL): Floating point arithmetic on money.
 * Dividing by 100 introduces floating point errors.
 * e.g. 1999 cents -> $19.990000000000002
 * Fix: Use toFixed(2) then parse, or use a decimal library.
 */
export function formatCurrency(cents: number, currency = "USD"): string {
  const amount = cents / 100; // floating point issue here
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

/**
 * Converts a user-entered dollar string to cents.
 * e.g. "10.50" -> 1050
 *
 * BUG 2 (CRITICAL): Floating point multiplication.
 * parseFloat("10.50") * 100 = 1049.9999999999999 in some JS engines.
 * Math.round() would fix this, but it's missing.
 * So 1050 cents becomes 1049 cents — user is undercharged by 1 cent.
 */
export function dollarsToCents(dollarString: string): number {
  const dollars = parseFloat(dollarString);
  if (isNaN(dollars)) return 0;
  return dollars * 100; // should be Math.round(dollars * 100)
}

/**
 * Validates that an amount is a valid payment amount.
 *
 * BUG 3 (MEDIUM): No maximum amount check.
 * A user can submit a payment for Number.MAX_SAFE_INTEGER cents.
 * Also: no check that amount is an integer (cents should always be whole numbers).
 */
export function isValidAmount(cents: number): boolean {
  return cents > 0;
  // Missing: cents <= MAX_PAYMENT_CENTS (e.g. 1_000_000_00 = $1M limit)
  // Missing: Number.isInteger(cents)
}

/**
 * Adds two cent amounts together.
 * Safe because we stay in integer space.
 */
export function addAmounts(a: number, b: number): number {
  return a + b;
}

/**
 * Calculates a percentage fee on an amount.
 *
 * BUG 4 (MEDIUM): Returns a float, not rounded to cents.
 * 1.5% of 333 cents = 4.995, returned as 4.995
 * Callers expect integer cents.
 */
export function calculateFee(cents: number, feePercent: number): number {
  return cents * (feePercent / 100); // should be Math.round(...)
}
