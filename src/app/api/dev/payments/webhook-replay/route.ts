import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPaymentProvider } from '@/lib/payments/factory';
import { DevPaymentProvider } from '@/lib/payments/dev';

/**
 * POST /api/dev/payments/webhook-replay
 *
 * DEV-ONLY. Constructs a synthetic webhook payload (Razorpay-shaped),
 * signs it with the dev secret, and POSTs it to the real
 * /api/payments/webhook route. The webhook route does not branch on
 * provider — it just runs the active provider's verifyWebhookSignature.
 *
 * Use cases (see lifecycle scenarios D, E in docs/V1-LAUNCH.md):
 *   - Validate idempotency: send the same payload twice; second call
 *     returns {replay: true}.
 *   - Validate the failure path: send a payment.failed payload for
 *     an existing payment; orders.status should become 'payment_failed'.
 *   - Validate refund webhook handling: send refund.processed /
 *     refund.failed for an existing payment; payments.refund_status
 *     should land at 'succeeded' / 'failed'.
 *
 * Body shape:
 *   {
 *     event: 'payment.captured' | 'payment.failed' | 'refund.processed' | 'refund.failed',
 *     // For payment events:
 *     payment_id?: string,        // Razorpay payment id (we generate one if omitted)
 *     razorpay_order_id: string,  // our payments.razorpay_order_id
 *     amount?: number,            // paise; defaults to the payments.amount
 *     // For refund events:
 *     refund_id?: string,
 *     razorpay_payment_id?: string,
 *     error_description?: string, // for refund.failed
 *   }
 *
 * Hard guards:
 *   - 404 unless the active provider is the dev provider.
 *   - Authenticated only.
 */

function ok<T>(data: T) {
  return NextResponse.json({ data, error: null });
}
function err(message: string, code: string, status = 400) {
  return NextResponse.json({ data: null, error: { message, code } }, { status });
}

interface ReplayBody {
  event:                'payment.captured' | 'payment.failed' | 'refund.processed' | 'refund.failed';
  razorpay_order_id?:   string;
  razorpay_payment_id?: string;
  payment_id?:          string;
  refund_id?:           string;
  amount?:              number;
  error_description?:   string;
}

export async function POST(req: NextRequest) {
  const provider = getPaymentProvider();
  if (!(provider instanceof DevPaymentProvider)) {
    return err('Not found', 'NOT_FOUND', 404);
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err('Unauthorized', 'UNAUTHORIZED', 401);

  const body = (await req.json()) as ReplayBody;
  if (!body.event) return err('Missing event', 'MISSING_FIELD');

  // Build the Razorpay-shaped payload for the requested event.
  // Field names match what the webhook route expects.
  let payload: Record<string, unknown>;

  switch (body.event) {
    case 'payment.captured':
    case 'payment.failed': {
      if (!body.razorpay_order_id) {
        return err('Missing razorpay_order_id', 'MISSING_FIELD');
      }
      const paymentId = body.payment_id ?? `dev_payment_${Date.now()}`;
      payload = {
        event: body.event,
        payload: {
          payment: {
            entity: {
              id:       paymentId,
              order_id: body.razorpay_order_id,
              status:   body.event === 'payment.captured' ? 'captured' : 'failed',
              amount:   body.amount ?? 0,
              currency: 'INR',
              method:   'dev',
              ...(body.event === 'payment.failed'
                ? { error_description: body.error_description ?? 'simulated_failure' }
                : {}),
            },
          },
        },
      };
      break;
    }

    case 'refund.processed':
    case 'refund.failed': {
      if (!body.razorpay_payment_id) {
        return err('Missing razorpay_payment_id', 'MISSING_FIELD');
      }
      const refundId = body.refund_id ?? `dev_refund_${Date.now()}`;
      payload = {
        event: body.event,
        payload: {
          refund: {
            entity: {
              id:         refundId,
              payment_id: body.razorpay_payment_id,
              amount:     body.amount ?? 0,
              status:     body.event === 'refund.processed' ? 'processed' : 'failed',
              ...(body.event === 'refund.failed'
                ? { error_description: body.error_description ?? 'simulated_refund_failure' }
                : {}),
            },
          },
        },
      };
      break;
    }
  }

  const rawBody = JSON.stringify(payload);
  const signature = provider.signWebhook(rawBody);

  // POST to the real webhook route. This is an in-app fetch — same
  // origin, no external network. We could call the handler directly,
  // but going through the HTTP boundary exercises the full path
  // including the request parsing and signature header pickup.
  const origin = req.nextUrl.origin;
  const webhookRes = await fetch(`${origin}/api/payments/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type':         'application/json',
      'X-Razorpay-Signature': signature,
    },
    body: rawBody,
  });

  const webhookJson = await webhookRes.json();
  return NextResponse.json(
    {
      data: {
        sent:           payload,
        webhook_status: webhookRes.status,
        webhook_body:   webhookJson,
      },
      error: null,
    },
    { status: webhookRes.ok ? 200 : 502 },
  );
}
