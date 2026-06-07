/**
 * Formatting helpers. Pure functions — no UI deps.
 *
 * For class-name composition use `cn` from `@/lib/utils/cn`.
 */

/**
 * Format a paise amount (₹ × 100) as a localised INR string.
 * Money is stored in paise everywhere — never use floats for currency.
 *
 * @example formatPrice(1000000) → "₹10,000"
 */
export function formatPrice(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

/**
 * Format an ISO date string as `D MMM YYYY` in en-IN.
 *
 * @example formatDate("2026-05-29") → "29 May 2026"
 */
export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}
