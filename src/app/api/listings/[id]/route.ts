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

  const { data: listing, error: fetchErr } = await supabase
    .from('listings')
    .select('id, seller_id, status')
    .eq('id', params.id)
    .single();

  if (fetchErr || !listing) return err('Listing not found', 'NOT_FOUND', 404);
  if (listing.seller_id !== user.id) return err('Forbidden', 'FORBIDDEN', 403);

  const body = await req.json() as { status?: string; asking_price?: number };

  // ── Price update (approved listings only) ────────────────────────────────
  if (body.asking_price !== undefined) {
    if (listing.status !== 'approved') {
      return err('Price can only be updated on live listings', 'INVALID_STATE');
    }
    if (!Number.isInteger(body.asking_price) || body.asking_price <= 0) {
      return err('asking_price must be a positive integer in paise', 'INVALID_VALUE');
    }
    const { data, error } = await supabase
      .from('listings')
      .update({ asking_price: body.asking_price })
      .eq('id', params.id)
      .select('id, asking_price')
      .single();
    if (error) return err(error.message, error.code ?? 'DB_ERROR', 500);
    return ok(data);
  }

  // ── Status transition ────────────────────────────────────────────────────
  if (body.status) {
    const allowedTransitions: Record<string, string[]> = {
      approved: ['delisted'],
      rejected: ['draft'],
      pending:  ['draft'],     // seller pulls back from review
    };
    const allowed = allowedTransitions[listing.status] ?? [];
    if (!allowed.includes(body.status)) {
      return err(
        `Cannot transition from ${listing.status} to ${body.status}`,
        'INVALID_TRANSITION',
      );
    }
    const { data, error } = await supabase
      .from('listings')
      .update({ status: body.status })
      .eq('id', params.id)
      .select('id, status')
      .single();
    if (error) return err(error.message, error.code ?? 'DB_ERROR', 500);
    return ok(data);
  }

  return err('Nothing to update', 'NO_OP');
}
