import crypto from 'crypto';

/**
 * Verify a Razorpay webhook signature.
 * Call this before processing any webhook event. Returns false
 * (rather than throwing) on missing secret so callers can decide
 * how to respond.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeCompareHex(expected, signature);
}

/**
 * Verify the payment signature returned to the client after the
 * Razorpay checkout modal completes successfully.
 * Hash format: HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret).
 */
export function verifyPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
  return safeCompareHex(expected, signature);
}

/**
 * Timing-safe hex comparison. crypto.timingSafeEqual requires equal-length
 * buffers; if a malformed signature is passed we fail closed without
 * leaking length information via thrown errors.
 */
function safeCompareHex(expectedHex: string, actualHex: string): boolean {
  if (expectedHex.length !== actualHex.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expectedHex, 'hex'), Buffer.from(actualHex, 'hex'));
  } catch {
    return false;
  }
}
