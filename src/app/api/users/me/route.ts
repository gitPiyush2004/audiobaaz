import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

function ok<T>(data: T) {
  return NextResponse.json({ data, error: null });
}
function err(message: string, code: string, status = 400) {
  return NextResponse.json({ data: null, error: { message, code } }, { status });
}

export async function PATCH(req: NextRequest) {
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

  const { data, error } = await supabase
    .from('users')
    .update(update)
    .eq('id', user.id)
    .select('id, full_name, city, pincode, upi_id, availability, phone')
    .single();

  if (error) return err(error.message, error.code ?? 'DB_ERROR', 500);
  return ok(data);
}
