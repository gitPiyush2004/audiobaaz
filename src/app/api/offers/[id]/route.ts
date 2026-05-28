import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

function ok<T>(data: T) {
  return NextResponse.json({ data, error: null });
}
function err(message: string, code: string, status = 400) {
  return NextResponse.json({ data: null, error: { message, code } }, { status });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err('Unauthorized', 'UNAUTHORIZED', 401);

  const { action } = await req.json() as { action: 'accept' | 'decline' };
  if (action !== 'accept' && action !== 'decline') {
    return err('action must be accept or decline', 'INVALID_ACTION');
  }

  const { data: offer, error: fetchErr } = await supabase
    .from('offers')
    .select('id, status, seller_id')
    .eq('id', params.id)
    .single();

  if (fetchErr || !offer) return err('Offer not found', 'NOT_FOUND', 404);
  if (offer.seller_id !== user.id) return err('Forbidden', 'FORBIDDEN', 403);
  if (offer.status !== 'pending') return err('Offer is no longer pending', 'INVALID_STATE');

  const update =
    action === 'accept'
      ? {
          status: 'accepted',
          buyer_must_pay_by: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }
      : { status: 'declined' };

  const { data, error } = await supabase
    .from('offers')
    .update(update)
    .eq('id', params.id)
    .select('id, status')
    .single();

  if (error) return err(error.message, error.code ?? 'DB_ERROR', 500);
  return ok(data);
}
