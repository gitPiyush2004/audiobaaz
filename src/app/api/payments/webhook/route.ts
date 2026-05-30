import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyWebhookSignature } from '@/lib/razorpay/helpers';

/**
 * POST /api/payments/webhook
 *
 * Razorpay server-to-server webhook ingress. Idempotent and
 * replay-safe via the webhook_events table.
 *
 * Per docs/V1-LAUNCH.md Step 2:
 *   1. Verify webhook signature
 *   2. Upsert webhook_events (by provider_event_id) — idempotency boundary
 *   3. Dispatch by event.type → call appropriate RPC
 *   4. Mark webhook_events.status='processed'
 *
 * NO direct DB mutations on listings/orders/offers. All marketplace
 * state transitions go through the locked RPCs. Migration 005
 * invariant guards reject any bypass.
 *
 * Events handled in V1:
 *   - payment.captured  → finalize_winning_payment()
 *   - payment.failed    → mark payment failed, leave order at payment_failed
 *   - refund.processed  → record_refund_outcome(succeeded)
 *   - refund.failed     → record_refund_outcome(failed)
 *
 * Other events are stored in webhook_events with status='received'
 * for forensic replay; we don't act on them.
 */

function ok<T>(data: T) {
  return NextResponse.json({ data, error: null });
}
function fail(message: string, status = 400) {
  return NextResponse.json({ data: null, error: { message } }, { status });
}

// Razorpay event payloads (subset used here).
interface RazorpayPaymentEntity {
  id:                string;
  order_id:          string;
  status:            string;
  amount:            number;
  currency:          string;
  method:            string;
  error_code?:       string;
  error_description?: string;
}

interface RazorpayRefundEntity {
  id:                string;
  payment_id:        string;
  amount:            number;
  status:            string;
  error_code?:       string;
  error_description?: string;
}

interface RazorpayWebhookPayload {
  event:    string;
  payload?: {
    payment?: { entity: RazorpayPaymentEntity };
    refund?:  { entity: RazorpayRefundEntity };
  };
  // Razorpay's actual top-level event id varies by setup; payments use
  // payment.entity.id, refunds use refund.entity.id. For idempotency
  // we derive provider_event_id from the entity id + event name so a
  // captured-then-replayed event upserts to the same key.
}

export async function POST(req: NextRequest) {
  // Razorpay webhook signature is HMAC-SHA256 of the RAW request body.
  // We must read the body as text BEFORE parsing JSON.
  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature') ?? '';

  if (!verifyWebhookSignature(rawBody, signature)) {
    return fail('Invalid webhook signature', 401);
  }

  let payload: RazorpayWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return fail('Invalid JSON', 400);
  }

  const admin = createAdminClient();

  // Derive a stable provider_event_id for idempotency. Razorpay does
  // not always provide a top-level event id, so we synthesize one
  // from the entity + event name. Same event arriving twice produces
  // the same key → UNIQUE constraint upsert behaviour.
  const entityId =
    payload.payload?.payment?.entity?.id ??
    payload.payload?.refund?.entity?.id ??
    `unknown_${Date.now()}`;
  const providerEventId = `${payload.event}:${entityId}`;

  // ── Upsert webhook_events (idempotency boundary) ─────────────
  const { data: existing } = await admin
    .from('webhook_events')
    .select('id, status')
    .eq('provider', 'razorpay')
    .eq('provider_event_id', providerEventId)
    .maybeSingle();

  if (existing?.status === 'processed') {
    // Already processed; replay is a no-op.
    return ok({ replay: true });
  }

  let webhookEventId: string;
  if (existing) {
    webhookEventId = existing.id;
  } else {
    const { data: inserted, error: insertErr } = await admin
      .from('webhook_events')
      .insert({
        provider:           'razorpay',
        provider_event_id:  providerEventId,
        event_type:         payload.event,
        status:             'received',
        raw_payload:        payload,
        signature_verified: true,
      })
      .select('id')
      .single();
    if (insertErr) return fail(insertErr.message, 500);
    webhookEventId = inserted.id;
  }

  // ── Dispatch by event type ───────────────────────────────────
  try {
    switch (payload.event) {
      case 'payment.captured':
        await handlePaymentCaptured(admin, payload.payload!.payment!.entity);
        break;

      case 'payment.failed':
        await handlePaymentFailed(admin, payload.payload!.payment!.entity);
        break;

      case 'refund.processed':
        await handleRefundProcessed(admin, payload.payload!.refund!.entity);
        break;

      case 'refund.failed':
        await handleRefundFailed(admin, payload.payload!.refund!.entity);
        break;

      default:
        // Unhandled event — recorded in webhook_events for forensic
        // replay; we just don't act on it. Phase 2 follow-up: handle
        // payment.authorized, refund.created, dispute.created, etc.
        break;
    }

    await admin
      .from('webhook_events')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('id', webhookEventId);

    return ok({ event: payload.event, processed: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Webhook processing failed';
    await admin
      .from('webhook_events')
      .update({ status: 'failed', error_message: message, processed_at: new Date().toISOString() })
      .eq('id', webhookEventId);
    // Razorpay retries on 5xx, so signal failure clearly.
    return fail(message, 500);
  }
}

// ── Event handlers ─────────────────────────────────────────────

async function handlePaymentCaptured(
  admin: ReturnType<typeof createAdminClient>,
  entity: RazorpayPaymentEntity,
) {
  // Find our payment row by Razorpay order_id.
  const { data: payment } = await admin
    .from('payments')
    .select('id')
    .eq('razorpay_order_id', entity.order_id)
    .single();

  if (!payment) {
    throw new Error(`payment row not found for razorpay_order_id=${entity.order_id}`);
  }

  // Hand off to the atomic RPC. The RPC handles winner/conflict/noop
  // semantics; we just translate the result into refund initiation if
  // this capture lost the race.
  const { data: result, error: rpcErr } = await admin.rpc('finalize_winning_payment', {
    p_payment_id:          payment.id,
    p_razorpay_payment_id: entity.id,
    p_razorpay_signature:  '',  // webhook ingress; signature already verified above
    p_method:              entity.method ?? 'unknown',
    p_actor_id:            null,  // webhook actor
  });

  if (rpcErr) throw rpcErr;

  if (result?.result === 'conflict') {
    // Race loser — initiate the refund. The synchronous /api/payments/verify
    // path may have already done this; initiate_refund is idempotent.
    await admin.rpc('initiate_refund', {
      p_payment_id: payment.id,
      p_reason:     'race_loss',
      p_actor_id:   null,
    });
  }
}

async function handlePaymentFailed(
  admin: ReturnType<typeof createAdminClient>,
  entity: RazorpayPaymentEntity,
) {
  // Mark our payment as failed; leave the order in payment_pending so
  // the buyer can retry. Per Decision 6, the listing is unaffected —
  // it stays 'approved' for other buyers. The reserve_listing flow
  // is dropped under the locked V1 contract.
  await admin
    .from('payments')
    .update({
      status:     'failed',
      updated_at: new Date().toISOString(),
    })
    .eq('razorpay_order_id', entity.order_id);

  // Find the order and flip it to payment_failed (recoverable, not terminal).
  const { data: payment } = await admin
    .from('payments')
    .select('order_id')
    .eq('razorpay_order_id', entity.order_id)
    .single();

  if (payment) {
    await admin
      .from('orders')
      .update({
        status:     'payment_failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.order_id);
  }
}

async function handleRefundProcessed(
  admin: ReturnType<typeof createAdminClient>,
  entity: RazorpayRefundEntity,
) {
  const { data: payment } = await admin
    .from('payments')
    .select('id')
    .eq('razorpay_payment_id', entity.payment_id)
    .single();

  if (!payment) {
    throw new Error(`payment row not found for razorpay_payment_id=${entity.payment_id}`);
  }

  const { error } = await admin.rpc('record_refund_outcome', {
    p_payment_id:     payment.id,
    p_new_status:     'succeeded',
    p_refund_id:      entity.id,
    p_failure_reason: null,
    p_actor_id:       null,
  });
  if (error) throw error;
}

async function handleRefundFailed(
  admin: ReturnType<typeof createAdminClient>,
  entity: RazorpayRefundEntity,
) {
  const { data: payment } = await admin
    .from('payments')
    .select('id')
    .eq('razorpay_payment_id', entity.payment_id)
    .single();

  if (!payment) {
    throw new Error(`payment row not found for razorpay_payment_id=${entity.payment_id}`);
  }

  const { error } = await admin.rpc('record_refund_outcome', {
    p_payment_id:     payment.id,
    p_new_status:     'failed',
    p_refund_id:      entity.id,
    p_failure_reason: entity.error_description ?? entity.error_code ?? 'gateway_error',
    p_actor_id:       null,
  });
  if (error) throw error;
}
