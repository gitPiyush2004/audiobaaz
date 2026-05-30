import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPaymentProvider } from '@/lib/payments/factory';

/**
 * POST /api/payments/verify
 *
 * Called by the client after the gateway checkout returns
 * successfully (Razorpay modal `handler`, or the dev "Simulate
 * payment" path). Verifies the signature, then hands off to
 * finalize_winning_payment(...) for the marketplace cascade.
 *
 * Per docs/V1-LAUNCH.md Step 2:
 *   1. Verify signature via the active PaymentProvider
 *   2. Call finalize_winning_payment()
 *   3. Return the typed RPC result
 *
 * NO direct DB mutations on listings/orders/offers. State transitions
 * happen exclusively inside the RPC. Migration 005 invariant guards
 * reject any attempt to bypass this.
 *
 * The webhook handler is the redundant ingress for the same event;
 * if this route succeeds and the webhook arrives later, the RPC
 * returns 'noop' on the replay. If this route fails for any reason,
 * the webhook is the safety net.
 */

function ok<T>(data: T) {
  return NextResponse.json({ data, error: null });
}
function err(message: string, code: string, status = 400) {
  return NextResponse.json({ data: null, error: { message, code } }, { status });
}

interface VerifyBody {
  razorpay_order_id:   string;
  razorpay_payment_id: string;
  razorpay_signature:  string;
  method?:             string; // 'card' | 'upi' | 'netbanking' | 'dev' | etc.
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const admin = createAdminClient();

  // ── Auth ─────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err('Unauthorized', 'UNAUTHORIZED', 401);

  const body = (await req.json()) as VerifyBody;

  if (!body.razorpay_order_id || !body.razorpay_payment_id || !body.razorpay_signature) {
    return err('Missing payment fields', 'MISSING_FIELD');
  }

  // ── Verify signature via the active provider ─────────────────
  const provider = getPaymentProvider();
  const valid = provider.verifyPaymentSignature({
    providerOrderId:   body.razorpay_order_id,
    providerPaymentId: body.razorpay_payment_id,
    signature:         body.razorpay_signature,
  });
  if (!valid) return err('Invalid payment signature', 'INVALID_SIGNATURE', 400);

  // ── Look up our payment row ──────────────────────────────────
  const { data: payment } = await admin
    .from('payments')
    .select('id, order_id, amount')
    .eq('razorpay_order_id', body.razorpay_order_id)
    .single();

  if (!payment) {
    // Payment row should exist from /api/payments/create. If not,
    // something is very wrong — let the webhook handle it.
    return err('Payment record not found', 'NOT_FOUND', 404);
  }

  // ── Hand off to the atomic RPC ───────────────────────────────
  const { data: result, error: rpcErr } = await admin.rpc('finalize_winning_payment', {
    p_payment_id:          payment.id,
    p_razorpay_payment_id: body.razorpay_payment_id,
    p_razorpay_signature:  body.razorpay_signature,
    p_method:              body.method ?? 'card',
    p_actor_id:            user.id,
  });

  if (rpcErr) return err(rpcErr.message, 'RPC_ERROR', 500);

  // ── Release the checkout lock ────────────────────────────────
  // On winner, lock is no longer needed (listing is sold).
  // On conflict, the buyer lost — also no need to hold the lock.
  // On noop, the lock might still be held; release it for the next
  // buyer. Either way, releasing is idempotent.
  if (result?.result === 'winner' || result?.result === 'conflict') {
    const { data: order } = await admin
      .from('orders')
      .select('listing_id')
      .eq('id', payment.order_id)
      .single();
    if (order) {
      await admin.rpc('release_checkout_lock', {
        p_listing_id: order.listing_id,
        p_buyer_id:   user.id,
      });
    }
  }

  // ── Conflict → race-loser refund ─────────────────────────────
  // The RPC marked this order 'cancelled' and recorded the audit
  // event. Now we initiate the refund. For real Razorpay this is
  // a network call; for the dev provider it returns instantly. The
  // PaymentProvider abstracts the difference.
  if (result?.result === 'conflict') {
    await admin.rpc('initiate_refund', {
      p_payment_id: payment.id,
      p_reason:     'race_loss',
      p_actor_id:   user.id,
    });

    // Best-effort: actually call the gateway refund API. If this
    // succeeds, the webhook will fire record_refund_outcome later.
    // If it fails, refund_status stays 'pending' and admin can retry.
    try {
      const refund = await provider.refund({
        providerPaymentId: body.razorpay_payment_id,
        amount:            payment.amount,
        notes:             { reason: 'race_loss', order_id: payment.order_id },
      });

      // For the dev provider (which returns 'succeeded' synchronously)
      // we can record the outcome immediately. For Razorpay we wait
      // for the webhook.
      if (provider.isSynthetic && refund.status === 'succeeded') {
        await admin.rpc('record_refund_outcome', {
          p_payment_id:     payment.id,
          p_new_status:     'succeeded',
          p_refund_id:      refund.providerRefundId,
          p_failure_reason: null,
          p_actor_id:       user.id,
        });
      }
    } catch {
      // Refund initiation failed; refund_status stays 'pending'.
      // Admin operations dashboard surfaces stuck refunds for retry.
    }
  }

  return ok(result);
}
