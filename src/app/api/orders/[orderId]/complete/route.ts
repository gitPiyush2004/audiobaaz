import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

function ok<T>(data: T) {
  return NextResponse.json({ data, error: null });
}
function err(message: string, code: string, status = 400) {
  return NextResponse.json({ data: null, error: { message, code } }, { status });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err('Unauthorized', 'UNAUTHORIZED', 401);

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: order } = await admin
    .from('orders')
    .select('id, buyer_id, status, inspection_expires_at')
    .eq('id', params.orderId)
    .single();

  if (!order) return err('Order not found', 'NOT_FOUND', 404);
  if (order.buyer_id !== user.id) return err('Forbidden', 'FORBIDDEN', 403);
  if (order.status !== 'inspection') {
    return err(`Order is not in inspection (status=${order.status})`, 'INVALID_STATUS');
  }

  const { error: updateErr } = await admin
    .from('orders')
    .update({ status: 'completed', completed_at: now, updated_at: now })
    .eq('id', params.orderId);

  if (updateErr) return err(updateErr.message, 'DB_ERROR', 500);

  // Audit trail — best-effort (non-fatal if order_events has cache issues)
  await admin.from('order_events').insert({
    order_id:   params.orderId,
    event_name: 'completed',
    actor_type: 'buyer',
    actor_id:   user.id,
    from_status: 'inspection',
    to_status:   'completed',
  }).then(() => {}).catch(() => {});

  return ok({ order_id: params.orderId, status: 'completed' });
}
