import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// Cross-device magic-link sign-in. See supabase/migrations/009_login_requests.sql.
//
//   POST  { email }               → create request; returns { id, secret } (requesting device)
//   PATCH { id }                  → approve request as the signed-in user (device that opened the email)
//   GET   ?id=  + x-login-secret  → poll; once approved returns a one-time code (requesting device)

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  const secret = randomBytes(32).toString('hex');
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('login_requests')
    .insert({ email: email.trim().toLowerCase(), secret_hash: sha256(secret) })
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Could not start sign-in' }, { status: 500 });
  }
  return NextResponse.json({ id: data.id, secret });
}

export async function PATCH(req: NextRequest) {
  const { id } = await req.json().catch(() => ({}));
  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid request id' }, { status: 400 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('login_requests')
    .select('email, expires_at, approved_at, consumed_at')
    .eq('id', id)
    .maybeSingle();

  if (!row || row.consumed_at || new Date(row.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Request expired' }, { status: 410 });
  }
  if (row.email !== user.email.toLowerCase()) {
    return NextResponse.json({ error: 'Email mismatch' }, { status: 403 });
  }

  if (!row.approved_at) {
    await admin
      .from('login_requests')
      .update({ approved_user_id: user.id, approved_at: new Date().toISOString() })
      .eq('id', id)
      .is('approved_at', null);
  }
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') ?? '';
  const secret = req.headers.get('x-login-secret') ?? '';
  if (!UUID_RE.test(id) || !secret) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('login_requests')
    .select('email, secret_hash, expires_at, approved_user_id, approved_at, consumed_at')
    .eq('id', id)
    .maybeSingle();

  if (!row || row.secret_hash !== sha256(secret)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (row.consumed_at) {
    return NextResponse.json({ status: 'consumed' });
  }
  if (new Date(row.expires_at) < new Date()) {
    return NextResponse.json({ status: 'expired' });
  }
  if (!row.approved_at) {
    return NextResponse.json({ status: 'pending' });
  }

  // Approved — consume atomically so the code is issued at most once.
  const { data: claimed } = await admin
    .from('login_requests')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', id)
    .is('consumed_at', null)
    .select('id');
  if (!claimed?.length) {
    return NextResponse.json({ status: 'consumed' });
  }

  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: row.email });
  if (error || !data.properties?.email_otp) {
    return NextResponse.json({ error: error?.message ?? 'Could not sign in' }, { status: 500 });
  }
  return NextResponse.json({ status: 'approved', email: row.email, email_otp: data.properties.email_otp });
}
