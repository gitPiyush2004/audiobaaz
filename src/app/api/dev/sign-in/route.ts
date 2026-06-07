import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Dev-only — returns an OTP that the client verifies directly.
// No email is sent. Blocked in production.
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEV_ROUTES !== 'true') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    email,
    email_otp: data.properties?.email_otp,
    hashed_token: data.properties?.hashed_token,
  });
}
