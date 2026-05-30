import type { PaymentProvider } from './provider';
import { RazorpayPaymentProvider } from './razorpay';
import { DevPaymentProvider } from './dev';

/**
 * getPaymentProvider — returns the active PaymentProvider implementation.
 *
 * Selection rules (evaluated in order):
 *
 *   1. If PAYMENT_PROVIDER === 'dev' AND NODE_ENV !== 'production',
 *      return DevPaymentProvider. This is the validation path for
 *      environments without Razorpay credentials.
 *
 *   2. Otherwise, return RazorpayPaymentProvider. This is the default
 *      and the only path used in production.
 *
 * Routes never branch on NODE_ENV or PAYMENT_PROVIDER themselves —
 * they call getPaymentProvider() and use the returned instance.
 *
 * The factory is instantiated lazily so importing this module does
 * not require Razorpay credentials at app boot.
 */

let _cached: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (_cached) return _cached;

  const explicit = process.env.PAYMENT_PROVIDER?.toLowerCase();
  const isProduction = process.env.NODE_ENV === 'production';

  if (explicit === 'dev' && !isProduction) {
    _cached = new DevPaymentProvider();
    return _cached;
  }

  _cached = new RazorpayPaymentProvider();
  return _cached;
}

/**
 * Reset the cached provider. Test-only — not intended for runtime use.
 */
export function _resetProviderCache(): void {
  _cached = null;
}
