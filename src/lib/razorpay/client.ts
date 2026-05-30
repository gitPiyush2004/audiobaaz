import Razorpay from 'razorpay';

/**
 * Lazy Razorpay client. Throws on first access if keys aren't set —
 * this avoids breaking app boot in environments without payment
 * credentials (local dev, preview deploys without secrets).
 *
 * Routes call `getRazorpay()` instead of importing a top-level
 * singleton, which means the import graph is safe even when the
 * environment isn't fully provisioned.
 */
let _razorpay: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (_razorpay) return _razorpay;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error(
      'RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set to use the payments API',
    );
  }

  _razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return _razorpay;
}
