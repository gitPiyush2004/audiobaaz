/**
 * PaymentProvider — abstraction over the external payment gateway.
 *
 * V1 has two implementations:
 *
 *   - RazorpayPaymentProvider (src/lib/payments/razorpay.ts)
 *     Wraps the existing src/lib/razorpay/{client,helpers}.ts code.
 *     This is the production path.
 *
 *   - DevPaymentProvider (src/lib/payments/dev.ts)
 *     Returns synthetic order ids + signatures without an outbound
 *     HTTP call. Selected when PAYMENT_PROVIDER=dev (and gated to
 *     non-production NODE_ENV inside the factory). Lets us validate
 *     the entire marketplace lifecycle — RPCs, state machine,
 *     audit trail, timeline, refunds — without Razorpay credentials.
 *
 * Why an interface? Because the codebase has two known providers in
 * V1 (real + dev), and the dev provider has to behave well enough
 * that `/api/payments/{create,verify,webhook}` and CheckoutForm can
 * exercise the same call shape they will use against Razorpay later.
 *
 * The interface is intentionally narrow: only the operations the
 * routes actually invoke. createOrder, verifyPaymentSignature,
 * verifyWebhookSignature, refund. New gateways add an
 * implementation; the routes don't change.
 */

export interface CreateOrderInput {
  /** Amount in paise. Both Razorpay and our DB store paise. */
  amount: number;
  /** ISO 4217. V1 is always 'INR'. */
  currency: string;
  /** Short receipt string. Razorpay limits this to 40 chars. */
  receipt: string;
  /** Free-form metadata. Razorpay accepts up to ~15 keys. */
  notes?: Record<string, string>;
}

export interface CreateOrderResult {
  /** Provider-side order id. Maps to payments.razorpay_order_id. */
  providerOrderId: string;
  amount: number;
  currency: string;
}

export interface VerifyPaymentSignatureInput {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}

export interface VerifyWebhookSignatureInput {
  rawBody: string;
  signature: string;
}

export interface RefundInput {
  providerPaymentId: string;
  /** Amount in paise. Pass full payment amount for full refunds. */
  amount: number;
  notes?: Record<string, string>;
}

export interface RefundResult {
  providerRefundId: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
}

/**
 * Modal parameters returned to the client. The dev provider returns
 * a stub with `synthetic: true` so CheckoutForm can branch into a
 * "Simulate payment" affordance instead of opening the Razorpay modal.
 */
export interface ClientModalParams {
  providerOrderId: string;
  /** Razorpay's public key id; null/undefined for dev provider. */
  publicKey: string | null;
  amount: number;
  currency: string;
  /** True when the active provider is synthetic (dev). */
  synthetic: boolean;
}

export interface PaymentProvider {
  /** Provider name for logging / audit. 'razorpay' | 'dev'. */
  readonly name: string;

  /** True for the dev provider; false for real gateways. */
  readonly isSynthetic: boolean;

  /** Create a gateway-side order. */
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;

  /** Verify the post-checkout signature returned to the client. */
  verifyPaymentSignature(input: VerifyPaymentSignatureInput): boolean;

  /** Verify the X-Razorpay-Signature header on inbound webhooks. */
  verifyWebhookSignature(input: VerifyWebhookSignatureInput): boolean;

  /** Initiate a refund at the gateway. */
  refund(input: RefundInput): Promise<RefundResult>;

  /**
   * Build the modal parameter bag returned to the client from
   * /api/payments/create. Real provider returns the live key + order;
   * dev provider returns a synthetic stub.
   */
  buildClientModalParams(order: CreateOrderResult): ClientModalParams;

  /**
   * For the dev provider: produce a payment_id + signature pair that
   * verifyPaymentSignature() will accept. Throws on real providers
   * (where the client gets these from the gateway, not from us).
   *
   * Used by CheckoutForm's "Simulate payment" button to feed the real
   * /api/payments/verify route.
   */
  simulatePayment?(providerOrderId: string): Promise<{
    providerPaymentId: string;
    signature: string;
  }>;
}
