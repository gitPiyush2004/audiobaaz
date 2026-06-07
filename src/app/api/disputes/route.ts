import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

function err(message: string, code: string, status = 400) {
  return NextResponse.json({ data: null, error: { message, code } }, { status });
}

const VALID_REASONS = [
  'condition_mismatch', 'non_functional',
  'missing_accessory', 'not_received', 'wrong_item',
] as const;

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err('Unauthorized', 'UNAUTHORIZED', 401);

  const body = await req.json() as {
    order_id:    string;
    reason:      string;
    description: string;
  };

  if (!body.order_id)                          return err('order_id required', 'MISSING_FIELD');
  if (!VALID_REASONS.includes(body.reason as typeof VALID_REASONS[number])) {
    return err('Invalid reason', 'INVALID_REASON');
  }
  if (!body.description?.trim())               return err('description required', 'MISSING_FIELD');

  const admin = createAdminClient();

  // Fetch order — must belong to this buyer and be in inspection window
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (admin as any)
    .from('orders')
    .select('id, buyer_id, seller_id, status, inspection_expires_at')
    .eq('id', body.order_id)
    .eq('buyer_id', user.id)
    .single();

  if (!order)                          return err('Order not found', 'NOT_FOUND', 404);
  if (order.status !== 'inspection')   return err('Order is not in the inspection period', 'INVALID_STATE');
  if (order.inspection_expires_at && new Date(order.inspection_expires_at) < new Date()) {
    return err('Inspection window has expired', 'WINDOW_EXPIRED');
  }

  // Create dispute
  const { data: dispute, error: disputeErr } = await admin
    .from('disputes')
    .insert({
      order_id:    body.order_id,
      buyer_id:    user.id,
      seller_id:   order.seller_id,
      reason:      body.reason,
      description: body.description.trim(),
      status:      'open',
    })
    .select('id')
    .single();

  if (disputeErr) return err(disputeErr.message, disputeErr.code ?? 'DB_ERROR', 500);

  // Mark order as disputed
  await admin.from('orders').update({ status: 'disputed' }).eq('id', body.order_id);

  return NextResponse.json({ data: { dispute_id: dispute.id }, error: null });
}
