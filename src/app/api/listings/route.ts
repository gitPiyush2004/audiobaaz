import { createClient } from '@/lib/supabase/server';
import { sendTelegramMessage } from '@/lib/telegram';
import { NextRequest, NextResponse } from 'next/server';

function ok<T>(data: T) {
  return NextResponse.json({ data, error: null });
}

function err(message: string, code: string, status = 400) {
  return NextResponse.json({ data: null, error: { message, code } }, { status });
}

function generateSlug(brand: string): string {
  const clean = brand.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
  const ts   = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 5);
  return `${clean}-${ts}${rand}`;
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err('Unauthorized', 'UNAUTHORIZED', 401);

  const body = await req.json();

  // ── Draft auto-save (no photos required, minimal validation) ───────────────
  if (body.saveAsDraft === true) {
    if (!body.productBrand || !body.productName || !body.productTypeId) {
      return err('Brand, name, and category are required for a draft', 'MISSING_FIELD');
    }

    const conditionNotes = body.conditionChecks
      ? Object.entries(body.conditionChecks as Record<string, boolean>)
          .filter(([, v]) => v).map(([k]) => k).join(', ') || null
      : null;

    const { data, error } = await supabase
      .from('listings')
      .insert({
        seller_id:       user.id,
        product_name:    body.productName,
        brand:           body.productBrand,
        category:        body.productTypeId,
        condition_grade: body.grade ?? 'A',
        condition_notes: conditionNotes ?? null,
        inclusions:      body.inclusions ?? {},
        photos:          body.photoUrls ?? [],
        asking_price:    body.askingPricePaise ?? 0,
        is_negotiable:   false,
        status:          'draft',
        slug:            generateSlug(body.productBrand),
      })
      .select('id, slug')
      .single();

    if (error) return err(error.message, error.code ?? 'DB_ERROR', 500);
    return ok(data);
  }

  // ── Full submission ──────────────────────────────────────────────────────────
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

  // Notify seller via Telegram (best-effort)
  const { data: seller } = await supabase
    .from('users')
    .select('telegram_chat_id, telegram_alerts')
    .eq('id', user.id)
    .single();

  if (seller?.telegram_chat_id && (seller.telegram_alerts as { listing_approved?: boolean })?.listing_approved !== false) {
    await sendTelegramMessage(
      seller.telegram_chat_id,
      `<b>Listing submitted ✓</b>\n\n<b>${body.productBrand} ${body.productName}</b> is in the review queue.\n\nWe typically approve within 2–4 hours between 9 am and 9 pm IST. You'll get a message here when it goes live.`,
    );
  }

  return ok(data);
}
