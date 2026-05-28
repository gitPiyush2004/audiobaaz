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

  const body = await req.json();

  // Only allow seller-initiated status transitions
  const allowedTransitions: Record<string, string[]> = {
    approved: ['delisted'],
    rejected: ['draft'],
  };

  if (body.status) {
    const allowed = allowedTransitions[listing.status] ?? [];
    if (!allowed.includes(body.status)) {
      return err(
        `Cannot transition from ${listing.status} to ${body.status}`,
        'INVALID_TRANSITION',
      );
    }
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
