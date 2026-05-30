import crypto from 'crypto';
import type {
  ClientModalParams,
  CreateOrderInput,
  CreateOrderResult,
  PaymentProvider,
  RefundInput,
  RefundResult,
  VerifyPaymentSignatureInput,
  VerifyWebhookSignatureInput,
} from './provider';

/**
 * DevPaymentProvider — synthetic payment gateway for V1 validation
 * without Razorpay credentials.
 *
 * Generates deterministic-looking provider ids, signs payloads with
 * a dev secret, and accepts the same signatures back for verification.
 * The real Razorpay-side network call is the only thing this skips —
 * everything else (route handlers, RPCs, signature verification,
 * webhook idempotency) runs identically against this provider.
 *
 * Selection: PAYMENT_PROVIDER=dev. The factory in factory.ts also
 * gates on NODE_ENV !== 'production' so this can never be selected
 * in the production deploy by accident.
 *
 * The dev secret is read from PAYMENT_DEV_SECRET (any non-empty
 * string). Sign and verify both use it — there's no asymmetric
 * "key vs webhook secret" split because there's no real gateway.
 */

const DEFAULT_DEV_SECRET = 'audiobaaz-dev-payment-secret';

export class DevPaymentProvider implements PaymentProvider {
  readonly name = 'dev';
  readonly isSynthetic = true;

  private get secret(): string {
    return process.env.PAYMENT_DEV_SECRET || DEFAULT_DEV_SECRET;
  }

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    return {
      providerOrderId: `dev_order_${randomHex(16)}`,
      amount: input.amount,
      currency: input.currency,
    };
  }

  verifyPaymentSignature(input: VerifyPaymentSignatureInput): boolean {
    const expected = signPayment(this.secret, input.providerOrderId, input.providerPaymentId);
    return safeCompareHex(expected, input.signature);
  }

  verifyWebhookSignature(input: VerifyWebhookSignatureInput): boolean {
    const expected = crypto
      .createHmac('sha256', this.secret)
      .update(input.rawBody)
      .digest('hex');
    return safeCompareHex(expected, input.signature);
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    // Dev refunds succeed instantly. The marketplace cascade
    // (initiate_refund + record_refund_outcome) still runs through
    // the real RPCs — we just skip the gateway round-trip.
    return {
      providerRefundId: `dev_refund_${randomHex(16)}`,
      status: 'succeeded',
    };
  }

  buildClientModalParams(order: CreateOrderResult): ClientModalParams {
    return {
      providerOrderId: order.providerOrderId,
      publicKey: null,
      amount: order.amount,
      currency: order.currency,
      synthetic: true,
    };
  }

  /**
   * Build a payment_id + signature pair the verify route will accept.
   * CheckoutForm's "Simulate payment" affordance calls this via
   * /api/dev/payments/simulate, then POSTs the result to /api/payments/verify.
   * The verify route does not know it came from us — it runs the same
   * signature check it would for Razorpay.
   */
  async simulatePayment(providerOrderId: string): Promise<{
    providerPaymentId: string;
    signature: string;
  }> {
    const providerPaymentId = `dev_payment_${randomHex(16)}`;
    const signature = signPayment(this.secret, providerOrderId, providerPaymentId);
    return { providerPaymentId, signature };
  }

  /**
   * Build a webhook payload + signature pair the webhook route will
   * accept. Used by /api/dev/payments/webhook-replay to validate the
   * inbound webhook path (idempotency, replay handling, RPC dispatch)
   * without Razorpay actually firing webhooks at us.
   */
  signWebhook(rawBody: string): string {
    return crypto.createHmac('sha256', this.secret).update(rawBody).digest('hex');
  }
}

function signPayment(secret: string, orderId: string, paymentId: string): string {
  return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
}

function randomHex(bytes: number): string {
  return crypto.randomBytes(bytes).toString('hex');
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
