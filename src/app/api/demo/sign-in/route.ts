import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Public demo login — signs in ONE pre-configured demo account only.
// Enabled only when DEMO_ACCOUNT_EMAIL is set. Unlike /api/dev/sign-in it
// never accepts an arbitrary email, so it cannot be used to access other users.
export async function POST() {
  const email = process.env.DEMO_ACCOUNT_EMAIL;
  if (!email) {
    return NextResponse.json({ error: 'Demo login is not enabled' }, { status: 404 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? 'Demo login failed' }, { status: 500 });
  }

  // Make sure the demo profile is complete so visitors skip onboarding.
  const { data: profile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', data.user.id)
    .maybeSingle();

  if (!profile?.full_name) {
    const { error: profileError } = await supabase.from('users').upsert({
      id:        data.user.id,
      email,
      full_name: process.env.DEMO_ACCOUNT_NAME ?? 'Demo Seller',
      phone:     process.env.DEMO_ACCOUNT_PHONE ?? '+919000000001',
      city:      'Mumbai',
      pincode:   '400001',
    });
    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ email, email_otp: data.properties?.email_otp });
}
