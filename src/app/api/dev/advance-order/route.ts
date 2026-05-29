import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Dev-only — advances an order to 'inspection' status to test the dispute flow.
// Blocked in production.
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { order_id } = await req.json();
  if (!order_id) return NextResponse.json({ error: 'order_id required' }, { status: 400 });

  const now              = new Date();
  const inspectionExpiry = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

  const { error } = await createAdminClient()
    .from('orders')
    .update({
      status:               'inspection',
      delivered_at:         now.toISOString(),
      inspection_expires_at: inspectionExpiry,
    })
    .eq('id', order_id)
    .eq('buyer_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: { inspection_expires_at: inspectionExpiry }, error: null });
}
