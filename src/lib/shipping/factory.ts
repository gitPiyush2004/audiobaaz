import type { ShippingProvider } from './provider';
import { MockShippingProvider } from './mock';

/**
 * getShippingProvider — returns the active ShippingProvider implementation.
 *
 * Selection rules (evaluated in order):
 *
 *   1. SHIPPING_PROVIDER === 'mock' → MockShippingProvider
 *   2. SHIPPING_PROVIDER === 'shiprocket' → throws (not yet built)
 *      — placeholder until ShiprocketProvider lands.
 *   3. No SHIPROCKET_EMAIL configured → MockShippingProvider
 *   4. SHIPROCKET_EMAIL configured → throws (not yet built)
 *
 * Routes never branch on env state — they call getShippingProvider().
 *
 * The factory is instantiated lazily so importing this module does
 * not require any credentials at app boot.
 */

let _cached: ShippingProvider | null = null;

export function getShippingProvider(): ShippingProvider {
  if (_cached) return _cached;

  const explicit = process.env.SHIPPING_PROVIDER?.toLowerCase();

  if (explicit === 'mock') {
    _cached = new MockShippingProvider();
    return _cached;
  }

  if (explicit === 'shiprocket') {
    throw new Error('ShiprocketProvider not yet implemented');
  }

  // Default: if no Shiprocket creds, use the mock. This is the V1
  // working-mode default until credentials land.
  if (!process.env.SHIPROCKET_EMAIL) {
    _cached = new MockShippingProvider();
    return _cached;
  }

  // Shiprocket creds present but provider not built yet. Fail loud
  // rather than silently pick the mock.
  throw new Error('ShiprocketProvider not yet implemented');
}

export function _resetShippingProviderCache(): void {
  _cached = null;
}
