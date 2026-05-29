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

  function callbackUrl() {
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirect)}`;
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: callbackUrl() },
    });

    if (error) setError(error.message);
    else setSent(true);
    setLoading(false);
  }

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl() },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // On success the browser is redirected to Google, so no further state to set.
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
                Continue with Google or get a sign-in link by email.
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
          <>
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={loading}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface text-sm font-semibold text-foreground transition-colors hover:bg-surface/70 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Continue with Google
            </button>

            <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={sendLink} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
                <input
                  type="email"
                  required
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
          </>
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
