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

  const body = await req.json() as {
    status?: string;
    asking_price?: number;
    resubmit?: boolean;
    // draft resubmit fields
    productTypeId?: string; productBrand?: string; productName?: string;
    grade?: string; conditionChecks?: Record<string, boolean>;
    inclusions?: Record<string, boolean>; photoUrls?: string[];
    askingPricePaise?: number; negotiationEnabled?: boolean;
    floorPricePaise?: number | null; autoAcceptPaise?: number | null;
  };

  // ── Draft resubmission ───────────────────────────────────────────────────
  if (body.resubmit === true) {
    if (listing.status !== 'draft') {
      return err('Only drafts can be resubmitted', 'INVALID_STATE');
    }
    const required = ['productTypeId', 'productBrand', 'productName', 'grade', 'askingPricePaise'];
    for (const f of required) {
      if (!body[f as keyof typeof body]) return err(`Missing field: ${f}`, 'MISSING_FIELD');
    }
    if (!Array.isArray(body.photoUrls) || body.photoUrls.length === 0) {
      return err('At least one photo is required', 'NO_PHOTOS');
    }
    const conditionNotes = body.conditionChecks
      ? Object.entries(body.conditionChecks).filter(([, v]) => v).map(([k]) => k).join(', ') || null
      : null;

    const { data, error } = await supabase
      .from('listings')
      .update({
        product_name:          body.productName,
        brand:                 body.productBrand,
        category:              body.productTypeId,
        condition_grade:       body.grade,
        condition_notes:       conditionNotes,
        inclusions:            body.inclusions ?? {},
        photos:                body.photoUrls,
        asking_price:          body.askingPricePaise,
        is_negotiable:         body.negotiationEnabled ?? false,
        floor_price:           body.negotiationEnabled ? (body.floorPricePaise ?? null) : null,
        auto_accept_threshold: body.negotiationEnabled ? (body.autoAcceptPaise ?? null) : null,
        status:                'pending',
        submitted_at:          new Date().toISOString(),
      })
      .eq('id', params.id)
      .select('id, slug')
      .single();

    if (error) return err(error.message, error.code ?? 'DB_ERROR', 500);
    return ok(data);
  }

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
