import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

function ok<T>(data: T) {
  return NextResponse.json({ data, error: null });
}

function err(message: string, code: string, status = 400) {
  return NextResponse.json({ data: null, error: { message, code } }, { status });
}

function generateSlug(brand: string): string {
  const clean = brand.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${clean}-${rand}`;
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err('Unauthorized', 'UNAUTHORIZED', 401);

  const body = await req.json();

  const required = ['productTypeId', 'productBrand', 'productName', 'grade', 'askingPricePaise'];
  for (const field of required) {
    if (!body[field]) return err(`Missing field: ${field}`, 'MISSING_FIELD');
  }

  if (!Array.isArray(body.photoUrls) || body.photoUrls.length === 0) {
    return err('At least one photo is required', 'NO_PHOTOS');
  }

  const conditionNotes = body.conditionChecks
    ? Object.entries(body.conditionChecks as Record<string, boolean>)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(', ') || null
    : null;

  const { data, error } = await supabase
    .from('listings')
    .insert({
      seller_id:             user.id,
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
      slug:                  generateSlug(body.productBrand),
    })
    .select('id, slug')   // floor_price intentionally excluded
    .single();

  if (error) return err(error.message, error.code ?? 'DB_ERROR', 500);

  return ok(data);
}
