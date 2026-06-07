import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendTelegramMessage } from '@/lib/telegram';
import { pickOne } from '@/lib/utils/relations';

type Resolution = 'full_refund' | 'partial_refund' | 'rejected';

type OrderRow = { paid_price: number; listing_price: number };
type BuyerRow = { telegram_chat_id: string | null; buyer_score: number | null };
type SellerRow = { telegram_chat_id: string | null; seller_score: number | null };

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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

  const body = await req.json();
  const { resolution, refund_amount, admin_notes } = body as {
    resolution: Resolution;
    refund_amount: number;
    admin_notes: string;
  };

  if (!['full_refund', 'partial_refund', 'rejected'].includes(resolution)) {
    return NextResponse.json({ data: null, error: { message: 'Invalid resolution', code: 'INVALID_RESOLUTION' } }, { status: 400 });
  }
  if (!admin_notes?.trim()) {
    return NextResponse.json({ data: null, error: { message: 'Admin notes required', code: 'MISSING_NOTES' } }, { status: 400 });
  }
  if (resolution === 'partial_refund' && (!refund_amount || refund_amount <= 0)) {
    return NextResponse.json({ data: null, error: { message: 'Refund amount required for partial refund', code: 'MISSING_AMOUNT' } }, { status: 400 });
  }

  const adminClient = createAdminClient();

  // Fetch dispute with order + buyer/seller chat IDs
  const { data: dispute } = await adminClient
    .from('disputes')
    .select(`
      id, order_id, buyer_id, seller_id, status,
      orders!order_id ( paid_price, listing_price ),
      buyers:users!buyer_id   ( telegram_chat_id, buyer_score ),
      sellers:users!seller_id ( telegram_chat_id, seller_score )
    `)
    .eq('id', params.id)
    .in('status', ['open', 'under_review'])
    .single();

  if (!dispute) {
    return NextResponse.json({ data: null, error: { message: 'Dispute not found or already resolved', code: 'NOT_FOUND' } }, { status: 404 });
  }

  const order  = pickOne<OrderRow>(dispute.orders);
  const buyer  = pickOne<BuyerRow>(dispute.buyers);
  const seller = pickOne<SellerRow>(dispute.sellers);

  // Resolve dispute
  await adminClient.from('disputes').update({
    status:       'resolved',
    resolution,
    refund_amount: resolution === 'full_refund'
      ? order?.paid_price
      : resolution === 'partial_refund'
      ? refund_amount
      : 0,
    admin_notes:  admin_notes.trim(),
    resolved_by:  user.id,
    resolved_at:  new Date().toISOString(),
  }).eq('id', params.id);

  // Update order status
  const orderStatus = resolution === 'rejected' ? 'completed' : 'refunded';
  await adminClient.from('orders').update({ status: orderStatus }).eq('id', dispute.order_id);

  // Adjust trust scores — buyer wins: seller -5; seller wins: buyer -5
  if (resolution === 'full_refund' || resolution === 'partial_refund') {
    await adminClient
      .from('users')
      .update({ seller_score: Math.max(0, (seller?.seller_score ?? 100) - 5) })
      .eq('id', dispute.seller_id);
  } else {
    await adminClient
      .from('users')
      .update({ buyer_score: Math.max(0, (buyer?.buyer_score ?? 100) - 5) })
      .eq('id', dispute.buyer_id);
  }

  // Telegram notifications
  const resolutionMsg: Record<Resolution, { buyer: string; seller: string }> = {
    full_refund: {
      buyer:  '✅ <b>Dispute resolved — full refund</b>\n\nYour refund has been approved. You will receive the full amount shortly.',
      seller: '❌ <b>Dispute resolved — full refund to buyer</b>\n\nThe dispute was decided in the buyer\'s favour. No payout will be made.',
    },
    partial_refund: {
      buyer:  `✅ <b>Dispute resolved — partial refund</b>\n\nA partial refund has been approved.`,
      seller: `⚠️ <b>Dispute resolved — partial refund issued</b>\n\nYou will receive a reduced payout.`,
    },
    rejected: {
      buyer:  '❌ <b>Dispute rejected</b>\n\nYour dispute was not upheld. Escrow has been released to the seller.',
      seller: '✅ <b>Dispute resolved in your favour</b>\n\nThe dispute was rejected. Your payout will be processed.',
    },
  };

  if (buyer?.telegram_chat_id) {
    await sendTelegramMessage(buyer.telegram_chat_id, resolutionMsg[resolution].buyer);
  }
  if (seller?.telegram_chat_id) {
    await sendTelegramMessage(seller.telegram_chat_id, resolutionMsg[resolution].seller);
  }

  return NextResponse.json({ data: { resolution }, error: null });
}
