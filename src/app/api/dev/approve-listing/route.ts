import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// DEV-ONLY — directly approves a listing for validation testing.
// Gated by ENABLE_DEV_ROUTES=true (same guard as /api/dev/sign-in).
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEV_ROUTES !== 'true') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const { listing_id } = await req.json();
  if (!listing_id) {
    return NextResponse.json({ data: null, error: { message: 'listing_id required', code: 'MISSING_FIELD' } }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('listings')
    .update({ status: 'approved' })
    .eq('id', listing_id);

  if (error) {
    return NextResponse.json({ data: null, error: { message: error.message, code: 'DB_ERROR' } }, { status: 500 });
  }

  return NextResponse.json({ data: { listing_id, status: 'approved' }, error: null });
}
