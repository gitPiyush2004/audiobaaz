import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRazorpay } from '@/lib/razorpay/client';

/**
 * POST /api/payments/create
 *
 * Buyer-initiated checkout entry point. Phase 2 successor to /api/checkout/mock.
 *
 * Per docs/V1-LAUNCH.md Step 2:
 *   1. Acquire checkout_locks (soft lock; not a correctness primitive)
 *   2. Create Razorpay order
 *   3. Insert orders row at status='payment_pending'
 *   4. Insert payments row at status='created'
 *   5. Return modal params for the client
 *
 * Listing.status stays 'approved' until capture (Decision 6 of the locked
 * V1 contract). The lock just narrows the simultaneous-checkout window;
 * the lifetime invariant on listings.sold_offer_id is what guarantees
 * exclusivity.
 *
 * No direct listing/order/offer mutations beyond the inserts above.
 * The eventual capture writes flow exclusively through finalize_winning_payment().
 */

function ok<T>(data: T) {
  return NextResponse.json({ data, error: null });
}
function err(message: string, code: string, status = 400) {
  return NextResponse.json({ data: null, error: { message, code } }, { status });
}

interface CreateBody {
  listing_id:       string;
  delivery_name:    string;
  delivery_phone:   string;
  delivery_line1:   string;
  delivery_line2?:  string;
  delivery_city:    string;
  delivery_pincode: string;
  delivery_state:   string;
}

const REQUIRED_FIELDS: (keyof CreateBody)[] = [
  'listing_id',
  'delivery_name',
  'delivery_phone',
  'delivery_line1',
  'delivery_city',
  'delivery_pincode',
  'delivery_state',
];

const SHIPPING_FEE_PAISE = 0; // V1 — flat zero; revisit when shipping pricing lands

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const admin = createAdminClient();

  // ── Auth ─────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err('Unauthorized', 'UNAUTHORIZED', 401);

  // ── Validate body ────────────────────────────────────────────
  const body = (await req.json()) as CreateBody;
  for (const f of REQUIRED_FIELDS) {
    if (!body[f]?.toString().trim()) return err(`Missing field: ${f}`, 'MISSING_FIELD');
  }

  // ── Fetch listing ────────────────────────────────────────────
  const { data: listing } = await admin
    .from('listings')
    .select('id, seller_id, product_name, asking_price, status, sold_offer_id')
    .eq('id', body.listing_id)
    .single();

  if (!listing) return err('Listing not found', 'NOT_FOUND', 404);
  if (listing.seller_id === user.id) return err('Cannot buy your own listing', 'OWN_LISTING');
  if (listing.status !== 'approved' || listing.sold_offer_id !== null) {
    return err('Listing is not available', 'NOT_AVAILABLE');
  }

  // ── Acquire checkout lock ────────────────────────────────────
  // Soft lock; if held by another buyer, surface a friendly error.
  // If held by THIS buyer (idempotent retry), proceed.
  const { data: lockResult, error: lockErr } = await admin.rpc('acquire_checkout_lock', {
    p_listing_id: body.listing_id,
    p_buyer_id:   user.id,
  });
  if (lockErr) return err(lockErr.message, 'LOCK_ERROR', 500);
  if (lockResult?.result === 'held_by_other') {
    return err(
      'Another buyer is currently checking out. Try again in a moment.',
      'CHECKOUT_BUSY',
      409,
    );
  }

  // ── Compute prices ───────────────────────────────────────────
  const paid_price = listing.asking_price as number;
  const platform_fee = Math.floor(paid_price * 0.10);
  const seller_payout = paid_price - platform_fee;
  const total_amount = paid_price + SHIPPING_FEE_PAISE;

  // ── Create Razorpay order ────────────────────────────────────
  let razorpayOrder;
  try {
    razorpayOrder = await getRazorpay().orders.create({
      amount:   total_amount,        // paise — Razorpay also takes paise
      currency: 'INR',
      // Use a short receipt that fits Razorpay's 40-char limit:
      // "ab_<first8oflisting>_<timestampLast8>"
      receipt:  `ab_${body.listing_id.slice(0, 8)}_${Date.now().toString().slice(-8)}`,
      notes: {
        listing_id: body.listing_id,
        buyer_id:   user.id,
      },
    });
  } catch (e) {
    // Free the lock so a retry isn't blocked by our own outstanding lock.
    await admin.rpc('release_checkout_lock', {
      p_listing_id: body.listing_id,
      p_buyer_id:   user.id,
    });
    const message = e instanceof Error ? e.message : 'Razorpay order creation failed';
    return err(message, 'RAZORPAY_ERROR', 502);
  }

  // ── Insert orders + payments rows (atomic via the order, not the RPC) ───
  // Note: this is NOT the winner cascade. We're creating a payment_pending
  // order; ownership flips at capture, not now.
  const { data: order, error: orderErr } = await admin
    .from('orders')
    .insert({
      listing_id:       body.listing_id,
      buyer_id:         user.id,
      seller_id:        listing.seller_id,
      listing_price:    paid_price,
      paid_price,
      platform_fee,
      shipping_fee:     SHIPPING_FEE_PAISE,
      seller_payout,
      delivery_name:    body.delivery_name.trim(),
      delivery_phone:   body.delivery_phone.trim(),
      delivery_line1:   body.delivery_line1.trim(),
      delivery_line2:   body.delivery_line2?.trim() ?? null,
      delivery_city:    body.delivery_city.trim(),
      delivery_pincode: body.delivery_pincode.trim(),
      delivery_state:   body.delivery_state.trim(),
      status:           'payment_pending',
    })
    .select('id')
    .single();

  if (orderErr) {
    await admin.rpc('release_checkout_lock', {
      p_listing_id: body.listing_id,
      p_buyer_id:   user.id,
    });
    return err(orderErr.message, 'DB_ERROR', 500);
  }

  const { error: paymentErr } = await admin.from('payments').insert({
    order_id:          order.id,
    razorpay_order_id: razorpayOrder.id,
    amount:            total_amount,
    currency:          'INR',
    status:            'created',
  });

  if (paymentErr) {
    return err(paymentErr.message, 'DB_ERROR', 500);
  }

  // ── Return modal params ───────────────────────────────────────
  return ok({
    razorpay_order_id: razorpayOrder.id,
    razorpay_key_id:   process.env.RAZORPAY_KEY_ID,
    amount:            total_amount,
    currency:          'INR',
    order_id:          order.id,
  });
}
