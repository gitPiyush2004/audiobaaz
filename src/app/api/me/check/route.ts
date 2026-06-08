import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ name: null });
  }

  const name = (user.user_metadata?.full_name as string | undefined)
    || user.email
    || '';

  return NextResponse.json({ name });
}
