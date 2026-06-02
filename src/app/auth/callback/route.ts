import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

async function checkOnboarding(
  supabase: ReturnType<typeof createClient>,
  origin: string,
  next: string,
): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .single();
  if (!profile?.full_name) {
    return `${origin}/onboarding?next=${encodeURIComponent(next)}`;
  }
  return `${origin}${next}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const next = searchParams.get('next') ?? '/';

  const supabase = createClient();

  // PKCE flow — standard magic link
  const code = searchParams.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const dest = await checkOnboarding(supabase, origin, next);
      if (dest) return NextResponse.redirect(dest);
    }
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  // token_hash flow — admin-generated links (dev bypass)
  const token_hash = searchParams.get('token_hash');
  const type       = searchParams.get('type');
  if (token_hash && type) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.auth.verifyOtp({ type: type as any, token_hash });
    if (!error) {
      const dest = await checkOnboarding(supabase, origin, next);
      if (dest) return NextResponse.redirect(dest);
    }
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
