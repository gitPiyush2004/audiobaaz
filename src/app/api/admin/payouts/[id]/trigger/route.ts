import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendTelegramMessage } from '@/lib/telegram';
import { formatPrice } from '@/lib/utils/formatting';
import { pickOne } from '@/lib/utils/relations';

type SellerRow = { id: string; upi_id: string | null; telegram_chat_id: string | null };

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ data: null, error: { message: 'Forbidden', code: 'FORBIDDEN' } }, { status: 403 });
  }

  const adminClient = createAdminClient();

  const { data: order } = await adminClient
    .from('orders')
    .select(`
      id, seller_payout, payout_status,
      sellers:users!seller_id ( id, upi_id, telegram_chat_id )
    `)
    .eq('id', params.id)
    .eq('status', 'completed')
    .eq('payout_status', 'pending')
    .single();

  if (!order) {
    return NextResponse.json({ data: null, error: { message: 'Order not found or not eligible for payout', code: 'NOT_FOUND' } }, { status: 404 });
  }

  const seller = pickOne<SellerRow>(order.sellers);

  if (!seller?.upi_id) {
    return NextResponse.json({ data: null, error: { message: 'Seller has no UPI ID on file', code: 'NO_UPI' } }, { status: 400 });
  }

  // Mark as processing first to prevent double-trigger
  await adminClient
    .from('orders')
    .update({ payout_status: 'processing' })
    .eq('id', params.id);

  // V1: manual UPI — mark as paid immediately with a reference timestamp
  // V2: integrate Razorpay Payouts API here
  const reference = `PAY-${params.id.slice(0, 8).toUpperCase()}-${Date.now()}`;

  const { error } = await adminClient
    .from('orders')
    .update({
      payout_status:    'paid',
      payout_reference: reference,
      payout_at:        new Date().toISOString(),
    })
    .eq('id', params.id);

  if (error) {
    await adminClient.from('orders').update({ payout_status: 'failed' }).eq('id', params.id);
    return NextResponse.json({ data: null, error: { message: error.message, code: 'DB_ERROR' } }, { status: 500 });
  }

  // Notify seller via Telegram
  if (seller?.telegram_chat_id) {
    await sendTelegramMessage(
      seller.telegram_chat_id,
      `💸 <b>Payout sent!</b>\n\n${formatPrice(order.seller_payout)} has been sent to your UPI ID <code>${seller.upi_id}</code>.\n\nReference: <code>${reference}</code>`,
    );
  }

  return NextResponse.json({ data: { reference }, error: null });
}
