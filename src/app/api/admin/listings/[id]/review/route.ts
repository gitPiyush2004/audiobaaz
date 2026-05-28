import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendTelegramMessage } from '@/lib/telegram';

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
  const { action, reason } = body as { action: 'approved' | 'rejected'; reason?: string };

  if (!['approved', 'rejected'].includes(action)) {
    return NextResponse.json({ data: null, error: { message: 'Invalid action', code: 'INVALID_ACTION' } }, { status: 400 });
  }
  if (action === 'rejected' && !reason?.trim()) {
    return NextResponse.json({ data: null, error: { message: 'Rejection reason required', code: 'MISSING_REASON' } }, { status: 400 });
  }

  const adminClient = createAdminClient();

  // Fetch listing + seller telegram_chat_id
  const { data: listing } = await adminClient
    .from('listings')
    .select('id, product_name, status, seller_id, users!seller_id(telegram_chat_id)')
    .eq('id', params.id)
    .eq('status', 'pending')
    .single();

  if (!listing) {
    return NextResponse.json({ data: null, error: { message: 'Listing not found or not pending', code: 'NOT_FOUND' } }, { status: 404 });
  }

  // Update listing status
  const updatePayload: Record<string, string> = { status: action };
  if (action === 'rejected' && reason) updatePayload.rejection_reason = reason;

  const { error: updateError } = await adminClient
    .from('listings')
    .update(updatePayload)
    .eq('id', params.id);

  if (updateError) {
    return NextResponse.json({ data: null, error: { message: updateError.message, code: 'DB_ERROR' } }, { status: 500 });
  }

  // Log in listing_reviews
  await adminClient.from('listing_reviews').insert({
    listing_id: params.id,
    reviewed_by: user.id,
    action,
    notes: reason ?? null,
  });

  // Telegram notification to seller
  const sellerRaw = Array.isArray(listing.users) ? listing.users[0] : listing.users;
  const seller = sellerRaw as { telegram_chat_id: string | null } | null;
  if (seller?.telegram_chat_id) {
    const msg = action === 'approved'
      ? `✅ <b>Listing approved!</b>\n\n<b>${listing.product_name}</b> is now live on Audiobaaz.`
      : `❌ <b>Listing rejected</b>\n\n<b>${listing.product_name}</b> was not approved.\n\n<b>Reason:</b> ${reason}`;
    await sendTelegramMessage(seller.telegram_chat_id, msg);
  }

  return NextResponse.json({ data: { action }, error: null });
}
