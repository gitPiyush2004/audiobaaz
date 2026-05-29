import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendTelegramMessage } from '@/lib/telegram';

function ok<T>(data: T) {
  return NextResponse.json({ data, error: null });
}
function err(message: string, code: string, status = 400) {
  return NextResponse.json({ data: null, error: { message, code } }, { status });
}

export async function POST(req: NextRequest) {
  const supabase      = createClient();
  const adminSupabase = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err('Unauthorized', 'UNAUTHORIZED', 401);

  const body = await req.json() as {
    listing_id:    string;
    delivery_name:    string;
    delivery_phone:   string;
    delivery_line1:   string;
    delivery_line2?:  string;
    delivery_city:    string;
    delivery_pincode: string;
    delivery_state:   string;
  };

  const required = ['listing_id', 'delivery_name', 'delivery_phone', 'delivery_line1', 'delivery_city', 'delivery_pincode', 'delivery_state'];
  for (const f of required) {
    if (!body[f as keyof typeof body]?.trim()) return err(`Missing field: ${f}`, 'MISSING_FIELD');
  }

  // Fetch listing — must be approved
  const { data: listing } = await adminSupabase
    .from('listings')
    .select('id, seller_id, product_name, asking_price, status')
    .eq('id', body.listing_id)
    .single();

  if (!listing)                        return err('Listing not found', 'NOT_FOUND', 404);
  if (listing.status !== 'approved')   return err('Listing is not available', 'NOT_AVAILABLE');
  if (listing.seller_id === user.id)   return err('Cannot buy your own listing', 'OWN_LISTING');

  const paid_price    = listing.asking_price;
  const platform_fee  = Math.floor(paid_price * 0.10);
  const seller_payout = paid_price - platform_fee;
  const shipping_fee  = 0; // skipped for now

  const now       = new Date().toISOString();
  const mockOrdId = `mock_order_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const mockPayId = `mock_pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // Create order
  const { data: order, error: orderErr } = await adminSupabase
    .from('orders')
    .insert({
      listing_id:       body.listing_id,
      buyer_id:         user.id,
      seller_id:        listing.seller_id,
      listing_price:    paid_price,
      paid_price,
      platform_fee,
      shipping_fee,
      seller_payout,
      delivery_name:    body.delivery_name.trim(),
      delivery_phone:   body.delivery_phone.trim(),
      delivery_line1:   body.delivery_line1.trim(),
      delivery_line2:   body.delivery_line2?.trim() ?? null,
      delivery_city:    body.delivery_city.trim(),
      delivery_pincode: body.delivery_pincode.trim(),
      delivery_state:   body.delivery_state.trim(),
      status:           'escrow_held',
      escrow_held_at:   now,
    })
    .select('id')
    .single();

  if (orderErr) return err(orderErr.message, orderErr.code ?? 'DB_ERROR', 500);

  // Create mock payment record
  await adminSupabase.from('payments').insert({
    order_id:            order.id,
    razorpay_order_id:   mockOrdId,
    razorpay_payment_id: mockPayId,
    amount:              paid_price,
    currency:            'INR',
    status:              'captured',
  });

  // Mark listing as sold
  await adminSupabase
    .from('listings')
    .update({ status: 'sold', sold_at: now })
    .eq('id', body.listing_id);

  // Notify seller via Telegram (best-effort)
  const { data: seller } = await adminSupabase
    .from('users')
    .select('telegram_chat_id, full_name')
    .eq('id', listing.seller_id)
    .single();

  if (seller?.telegram_chat_id) {
    await sendTelegramMessage(
      seller.telegram_chat_id,
      `🎉 <b>Your listing sold!</b>\n\n<b>${listing.product_name}</b> was purchased.\n\nPrepare the item for shipping — you'll receive payout once the buyer confirms delivery.`,
    );
  }

  return ok({ order_id: order.id });
}
