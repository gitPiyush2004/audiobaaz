import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

function ok<T>(data: T) {
  return NextResponse.json({ data, error: null });
}
function err(message: string, code: string, status = 400) {
  return NextResponse.json({ data: null, error: { message, code } }, { status });
}

export async function PATCH(req: NextRequest) {
  // Verify identity with the user-scoped client
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err('Unauthorized', 'UNAUTHORIZED', 401);

  const body = await req.json();

  const allowed = ['full_name', 'city', 'pincode', 'upi_id', 'availability', 'phone', 'telegram_chat_id'];
  const update: Record<string, string> = {};
  for (const key of allowed) {
    if (key in body && body[key] !== undefined) update[key] = body[key];
  }

  if (update.availability) {
    const valid = ['active', 'away', 'paused'];
    if (!valid.includes(update.availability)) {
      return err('availability must be active, away, or paused', 'INVALID_VALUE');
    }
  }

  // Upsert via admin client so new users (no public.users row yet) are handled
  // correctly. Identity is already verified above — admin is used only to bypass
  // the missing INSERT RLS policy on first-time profile completion.
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('users')
    .upsert({ id: user.id, email: user.email, ...update }, { onConflict: 'id' })
    .select('id, full_name, city, pincode, upi_id, availability, phone')
    .single();

  if (error) return err(error.message, error.code ?? 'DB_ERROR', 500);
  return ok(data);
}
