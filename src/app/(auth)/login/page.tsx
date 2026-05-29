'use client';

import { Suspense, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

const inputCls = [
  'w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground',
  'placeholder:text-dim-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors',
].join(' ');

function LoginForm() {
  const [email, setEmail]     = useState('');
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const searchParams = useSearchParams();
  const redirect     = searchParams.get('redirect') ?? '/dashboard';
  const authError    = searchParams.get('error');
  const supabase     = useMemo(() => createClient(), []);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const callbackUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirect)}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: callbackUrl },
    });

    if (error) setError(error.message);
    else setSent(true);
    setLoading(false);
  }

  async function devSignIn() {
    if (!email) { setError('Enter an email first'); return; }
    setLoading(true);
    setError(null);

    // 1. Get OTP from server (no email sent)
    const res  = await fetch('/api/dev/sign-in', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email }),
    });
    const json = await res.json();
    if (json.error) { setError(json.error); setLoading(false); return; }

    // 2. Verify OTP directly in the browser — sets up the session
    const { error: otpError } = await supabase.auth.verifyOtp({
      email:  json.email,
      token:  json.email_otp,
      type:   'email',
    });
    if (otpError) { setError(otpError.message); setLoading(false); return; }

    // 3. Check if onboarding is needed
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single();
      if (!profile?.full_name) {
        window.location.href = `/onboarding?next=${encodeURIComponent(redirect)}`;
        return;
      }
    }

    window.location.href = redirect;
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <div className="mb-8 text-center">
          <Link href="/" className="font-heading text-xl font-bold text-foreground">
            audio<span className="text-accent">baaz</span>
          </Link>

          {!sent ? (
            <>
              <h1 className="mt-6 font-heading text-2xl font-bold text-foreground">Sign in</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter your email and we&apos;ll send you a sign-in link.
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-6 font-heading text-2xl font-bold text-foreground">Check your email</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a link to <span className="text-foreground">{email}</span>.
                Click it to sign in — it expires in 1 hour.
              </p>
            </>
          )}
        </div>

        {authError && (
          <p className="mb-4 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
            That link has expired or already been used. Request a new one below.
          </p>
        )}

        {!sent ? (
          <form onSubmit={sendLink} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
              <input
                type="email"
                required
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={inputCls}
              />
            </div>

            {error && (
              <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-accent text-sm font-semibold text-black transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? 'Sending…' : 'Send sign-in link'}
            </button>

            {process.env.NODE_ENV !== 'production' && (
              <button
                type="button"
                onClick={devSignIn}
                disabled={loading || !email}
                className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-dashed border-warning/40 bg-warning/5 text-sm font-medium text-warning transition-all hover:bg-warning/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ⚡ Dev: sign in without email
              </button>
            )}
          </form>
        ) : (
          <button
            onClick={() => { setSent(false); setEmail(''); }}
            className="w-full text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Use a different email
          </button>
        )}

      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
