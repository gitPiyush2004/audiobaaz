import { createClient } from '@/lib/supabase/server';
import { verifyPaymentSignature } from '@/lib/razorpay/helpers';
import { sendTelegramMessage } from '@/lib/telegram';
import { NextRequest, NextResponse } from 'next/server';

// Seller must ship within 48 hours of escrow
const SHIP_BY_HOURS = 48;

function ok<T>(data: T) {
  return NextResponse.json({ data, error: null });
}
function err(message: string, code: string, status = 400) {
  return NextResponse.json({ data: null, error: { message, code } }, { status });
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err('Unauthorized', 'UNAUTHORIZED', 401);

  const body = await req.json() as {
    order_id:            string;
    razorpay_order_id:   string;
    razorpay_payment_id: string;
    razorpay_signature:  string;
  };

  const required = ['order_id', 'razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature'] as const;
  for (const field of required) {
    if (!body[field]) return err(`Missing field: ${field}`, 'MISSING_FIELD');
  }

  // Verify signature — reject before any DB work
  const valid = verifyPaymentSignature(
    body.razorpay_order_id,
    body.razorpay_payment_id,
    body.razorpay_signature,
  );
  if (!valid) return err('Invalid payment signature', 'INVALID_SIGNATURE', 400);

  // Fetch the order + payment to validate ownership and current state
  const { data: order } = await supabase
    .from('orders')
    .select('id, buyer_id, seller_id, listing_id, offer_id, paid_price, status')
    .eq('id', body.order_id)
    .single();

  if (!order)                    return err('Order not found', 'NOT_FOUND', 404);
  if (order.buyer_id !== user.id) return err('Forbidden', 'FORBIDDEN', 403);

  const { data: payment } = await supabase
    .from('payments')
    .select('id, status')
    .eq('razorpay_order_id', body.razorpay_order_id)
    .single();

  if (!payment) return err('Payment record not found', 'NOT_FOUND', 404);

  // Idempotency — already processed (webhook may have beaten the client callback)
  if (payment.status === 'captured' || order.status === 'escrow_held') {
    return ok({ order_id: order.id, status: 'escrow_held' });
  }

  if (order.status !== 'payment_pending') {
    return err(`Order is in unexpected state: ${order.status}`, 'INVALID_STATE');
  }

  const now         = new Date();
  const shipBy      = new Date(now.getTime() + SHIP_BY_HOURS * 60 * 60 * 1000);

  // Update payment
  const { error: payErr } = await supabase
    .from('payments')
    .update({
      razorpay_payment_id: body.razorpay_payment_id,
      razorpay_signature:  body.razorpay_signature,
      status:              'captured',
    })
    .eq('id', payment.id);

  if (payErr) return err(payErr.message, payErr.code ?? 'DB_ERROR', 500);

  // Update order → escrow_held
  const { error: orderErr } = await supabase
    .from('orders')
    .update({
      status:               'escrow_held',
      escrow_held_at:       now.toISOString(),
      seller_must_ship_by:  shipBy.toISOString(),
    })
    .eq('id', order.id);

  if (orderErr) return err(orderErr.message, orderErr.code ?? 'DB_ERROR', 500);

  // Update listing → sold
  await supabase
    .from('listings')
    .update({ status: 'sold', sold_at: now.toISOString() })
    .eq('id', order.listing_id);

  // Mark offer paid if order came from an offer
  if (order.offer_id) {
    await supabase
      .from('offers')
      .update({ status: 'paid' })
      .eq('id', order.offer_id);
  }

  // Notify seller
  const { data: seller } = await supabase
    .from('users')
    .select('telegram_chat_id, telegram_alerts')
    .eq('id', order.seller_id)
    .single();

  if (seller?.telegram_chat_id) {
    const priceFmt = `₹${((order.paid_price as number) / 100).toLocaleString('en-IN')}`;
    const shipByFmt = shipBy.toLocaleString('en-IN', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
    await sendTelegramMessage(
      seller.telegram_chat_id,
      `<b>Order placed — payment received ✓</b>\n\nYour item sold for <b>${priceFmt}</b>. Funds are held in escrow.\n\nPlease ship by <b>${shipByFmt}</b>. Go to your dashboard to get the shipping label.`,
    );
  }

  return ok({ order_id: order.id, status: 'escrow_held' });
}
