import { createAdminClient } from '@/lib/supabase/admin';
import { verifyWebhookSignature } from '@/lib/razorpay/helpers';
import { sendTelegramMessage } from '@/lib/telegram';
import { NextRequest, NextResponse } from 'next/server';

const SHIP_BY_HOURS = 48;

// Razorpay webhook — no user auth, must verify signature instead.
// Uses admin client to bypass RLS (webhook runs outside user session).
export async function POST(req: NextRequest) {
  // Read raw body FIRST — needed for signature verification
  const rawBody  = await req.text();
  const signature = req.headers.get('x-razorpay-signature') ?? '';

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event: {
    event: string;
    payload: {
      payment?: { entity: {
        id: string; order_id: string; amount: number; status: string; method?: string;
      }};
    };
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const payment  = event.payload.payment?.entity;
  if (!payment) return NextResponse.json({ ok: true }); // unhandled event shape

  // Find our payment record by Razorpay order ID
  const { data: paymentRecord } = await supabase
    .from('payments')
    .select('id, order_id, status')
    .eq('razorpay_order_id', payment.order_id)
    .single();

  if (!paymentRecord) return NextResponse.json({ ok: true }); // unknown order — ignore

  // ── payment.captured ────────────────────────────────────────────────────────
  if (event.event === 'payment.captured') {
    // Idempotent — verify may have already processed this
    if (paymentRecord.status === 'captured') {
      return NextResponse.json({ ok: true });
    }

    const { data: order } = await supabase
      .from('orders')
      .select('id, seller_id, listing_id, offer_id, paid_price, status')
      .eq('id', paymentRecord.order_id)
      .single();

    if (!order || order.status === 'escrow_held') {
      return NextResponse.json({ ok: true }); // already handled by verify
    }

    const now    = new Date();
    const shipBy = new Date(now.getTime() + SHIP_BY_HOURS * 60 * 60 * 1000);

    await supabase
      .from('payments')
      .update({
        razorpay_payment_id: payment.id,
        status:              'captured',
        method:              payment.method ?? null,
      })
      .eq('id', paymentRecord.id);

    await supabase
      .from('orders')
      .update({
        status:              'escrow_held',
        escrow_held_at:      now.toISOString(),
        seller_must_ship_by: shipBy.toISOString(),
      })
      .eq('id', order.id);

    await supabase
      .from('listings')
      .update({ status: 'sold', sold_at: now.toISOString() })
      .eq('id', order.listing_id);

    if (order.offer_id) {
      await supabase
        .from('offers')
        .update({ status: 'paid' })
        .eq('id', order.offer_id);
    }

    // Notify seller
    const { data: seller } = await supabase
      .from('users')
      .select('telegram_chat_id')
      .eq('id', order.seller_id)
      .single();

    if (seller?.telegram_chat_id) {
      const priceFmt  = `₹${((order.paid_price as number) / 100).toLocaleString('en-IN')}`;
      const shipByFmt = shipBy.toLocaleString('en-IN', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      });
      await sendTelegramMessage(
        seller.telegram_chat_id,
        `<b>Order placed — payment received ✓</b>\n\nYour item sold for <b>${priceFmt}</b>. Funds are held in escrow.\n\nPlease ship by <b>${shipByFmt}</b>.`,
      );
    }
  }

  // ── payment.failed ───────────────────────────────────────────────────────────
  if (event.event === 'payment.failed') {
    await supabase
      .from('payments')
      .update({ status: 'failed' })
      .eq('id', paymentRecord.id);

    await supabase
      .from('orders')
      .update({ status: 'payment_failed' })
      .eq('id', paymentRecord.order_id);

    // Release listing back to approved so other buyers can attempt
    const { data: order } = await supabase
      .from('orders')
      .select('listing_id')
      .eq('id', paymentRecord.order_id)
      .single();

    if (order) {
      await supabase
        .from('listings')
        .update({ status: 'approved', reserved_at: null, reserved_until: null })
        .eq('id', order.listing_id);
    }
  }

  return NextResponse.json({ ok: true });
}
