import Razorpay from 'razorpay';
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
 * RazorpayPaymentProvider — production implementation.
 *
 * This is the existing src/lib/razorpay/{client,helpers}.ts behaviour
 * collapsed into a single class. Routes that previously called
 * getRazorpay().orders.create() directly now call provider.createOrder().
 *
 * The Razorpay SDK and crypto helpers stay encapsulated here. Routes
 * never import 'razorpay' or compute HMACs themselves.
 */
export class RazorpayPaymentProvider implements PaymentProvider {
  readonly name = 'razorpay';
  readonly isSynthetic = false;

  private _client: Razorpay | null = null;

  private get client(): Razorpay {
    if (this._client) return this._client;

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new Error(
        'RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set to use the Razorpay provider',
      );
    }

    this._client = new Razorpay({ key_id: keyId, key_secret: keySecret });
    return this._client;
  }

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const order = await this.client.orders.create({
      amount: input.amount,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes,
    });

    return {
      providerOrderId: order.id,
      // Razorpay returns amount as number in V1 SDK shapes; coerce defensively.
      amount: typeof order.amount === 'number' ? order.amount : Number(order.amount),
      currency: order.currency,
    };
  }

  verifyPaymentSignature(input: VerifyPaymentSignatureInput): boolean {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return false;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${input.providerOrderId}|${input.providerPaymentId}`)
      .digest('hex');
    return safeCompareHex(expected, input.signature);
  }

  verifyWebhookSignature(input: VerifyWebhookSignatureInput): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return false;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(input.rawBody)
      .digest('hex');
    return safeCompareHex(expected, input.signature);
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const refund = await this.client.payments.refund(input.providerPaymentId, {
      amount: input.amount,
      notes: input.notes,
    });

    // Razorpay refund.status is one of: pending | processed | failed.
    // Normalise to the PaymentProvider contract.
    const status = mapRazorpayRefundStatus(refund.status);

    return {
      providerRefundId: refund.id,
      status,
    };
  }

  buildClientModalParams(order: CreateOrderResult): ClientModalParams {
    return {
      providerOrderId: order.providerOrderId,
      publicKey: process.env.RAZORPAY_KEY_ID ?? null,
      amount: order.amount,
      currency: order.currency,
      synthetic: false,
    };
  }
}

function mapRazorpayRefundStatus(s: string | null | undefined): RefundResult['status'] {
  switch (s) {
    case 'processed':
      return 'succeeded';
    case 'failed':
      return 'failed';
    case 'pending':
    default:
      return 'processing';
  }
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
