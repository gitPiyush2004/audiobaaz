import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Daily keep-alive (scheduled in vercel.json). Supabase pauses free-tier
// projects after 7 days without activity; a tiny read once a day prevents it.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Housekeeping: drop cross-device login requests older than a day.
  await supabase
    .from('login_requests')
    .delete()
    .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  return NextResponse.json({ ok: true, products: count, at: new Date().toISOString() });
}
