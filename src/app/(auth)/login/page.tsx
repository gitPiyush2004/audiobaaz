'use client';

import { Suspense, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/layout/Logo';

// ── Product card data ─────────────────────────────────────────────────────────

type Product = {
  img: string;
  price: string;
  cat: string;
  grade: string;
  gradeBg: string;
  gradeColor: string;
};

const PRODUCTS: Product[] = [
  { img: '/images/signin-hp.png', price: '₹19,000', cat: 'Headphones', grade: 'A', gradeBg: '#0d2d18', gradeColor: '#4ade80' },
  { img: '/images/signin-sp.png', price: '₹24,000', cat: 'Speakers',   grade: 'B', gradeBg: '#2d1e00', gradeColor: '#fbbf24' },
  { img: '/images/signin-ie.png', price: '₹72,000', cat: 'IEMs',       grade: 'S', gradeBg: '#0d2540', gradeColor: '#60a5fa' },
  { img: '/images/signin-hp.png', price: '₹31,000', cat: 'Headphones', grade: 'A', gradeBg: '#0d2d18', gradeColor: '#4ade80' },
  { img: '/images/signin-ie.png', price: '₹45,000', cat: 'IEMs',       grade: 'A', gradeBg: '#0d2d18', gradeColor: '#4ade80' },
  { img: '/images/signin-sp.png', price: '₹18,500', cat: 'Speakers',   grade: 'A', gradeBg: '#0d2d18', gradeColor: '#4ade80' },
];

// ── Components ────────────────────────────────────────────────────────────────

function GearCard({ img, price, cat, grade, gradeBg, gradeColor }: Product) {
  return (
    <div
      style={{
        width: '190px',
        flexShrink: 0,
        background: '#111111',
        border: '1px solid #1e1e1e',
        overflow: 'hidden',
        transition: 'border-color 0.25s, transform 0.3s ease',
        cursor: 'pointer',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = '#333';
        el.style.transform = 'translateY(-3px)';
        const imgEl = el.querySelector('img') as HTMLImageElement | null;
        if (imgEl) imgEl.style.transform = 'scale(1.05)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = '#1e1e1e';
        el.style.transform = 'translateY(0)';
        const imgEl = el.querySelector('img') as HTMLImageElement | null;
        if (imgEl) imgEl.style.transform = 'scale(1)';
      }}
    >
      <div style={{
        width: '100%',
        height: '154px',
        background: '#0a0a0a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        padding: '10px',
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img}
          alt={cat}
          style={{ width: '100%', height: '100%', objectFit: 'contain', transition: 'transform 0.5s ease' }}
        />
      </div>
      <div style={{ padding: '12px 14px 14px', borderTop: '1px solid #1a1a1a' }}>
        <div style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff', marginBottom: '6px' }}>
          {price}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#444' }}>{cat}</span>
          <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 7px', background: gradeBg, color: gradeColor }}>{grade}</span>
        </div>
      </div>
    </div>
  );
}

function CardRow({ items, reverse }: { items: Product[]; reverse?: boolean }) {
  const doubled = [...items, ...items];
  return (
    <div className="login-row-wrap">
      <div className={reverse ? 'login-row-track-rev' : 'login-row-track'}>
        {doubled.map((p, i) => <GearCard key={i} {...p} />)}
      </div>
    </div>
  );
}

// ── Form ──────────────────────────────────────────────────────────────────────

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
    setLoading(true); setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: callbackUrl() },
    });
    if (error) setError(error.message);
    else setSent(true);
    setLoading(false);
  }

  async function signInWithGoogle() {
    setLoading(true); setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl() },
    });
    if (error) { setError(error.message); setLoading(false); }
  }

  async function devSignIn() {
    if (!email) { setError('Enter an email first'); return; }
    setLoading(true); setError(null);
    const res  = await fetch('/api/dev/sign-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const json = await res.json();
    if (json.error) { setError(json.error); setLoading(false); return; }
    const { error: otpError } = await supabase.auth.verifyOtp({
      email: json.email, token: json.email_otp, type: 'email',
    });
    if (otpError) { setError(otpError.message); setLoading(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('users').select('full_name').eq('id', user.id).single();
      if (!profile?.full_name) {
        window.location.href = `/onboarding?next=${encodeURIComponent(redirect)}`;
        return;
      }
    }
    window.location.href = redirect;
  }

  const font = '"Helvetica Neue", Helvetica, Arial, sans-serif';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#fff', fontFamily: font }}>

      {/* Nav */}
      <nav style={{
        height: '60px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 40px',
        borderBottom: '1px solid #E8E8E4',
        background: '#fff',
        zIndex: 10,
      }}>
        <Logo size={36} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <Link href="/browse" style={{ fontSize: '13px', fontWeight: 400, color: '#555', textDecoration: 'none' }}>
            Browse
          </Link>
          <Link
            href="/sell"
            style={{
              background: '#E8FF4D',
              color: '#0a0a0a',
              padding: '8px 20px',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            Sell With Us
          </Link>
        </div>
      </nav>

      {/* Two-column body */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>

        {/* Left — dark panel */}
        <div style={{
          background: '#0a0a0a',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '52px 0 52px 48px',
          gap: '36px',
          overflow: 'hidden',
        }}>

          {/* Headline */}
          <div>
            <div style={{
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#3a3a3a',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: '#22c55e',
                flexShrink: 0,
                display: 'inline-block',
              }} />
              Managed · Verified · Trusted
            </div>
            <div style={{
              fontSize: 'clamp(30px, 3.2vw, 42px)',
              fontWeight: 900,
              letterSpacing: '-0.04em',
              lineHeight: 0.92,
              color: '#fff',
            }}>
              Serious gear.
            </div>
            <div style={{
              fontSize: 'clamp(30px, 3.2vw, 42px)',
              fontWeight: 400,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              color: '#E8FF4D',
              fontStyle: 'italic',
              fontFamily: '"Instrument Serif", Georgia, serif',
              marginTop: '4px',
            }}>
              Waiting for you.
            </div>
          </div>

          {/* Sliding card rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <CardRow items={PRODUCTS} />
            <CardRow items={[...PRODUCTS].reverse()} reverse />
          </div>

          {/* Footer label */}
          <div style={{ fontSize: '11px', color: '#2a2a2a', letterSpacing: '0.06em' }}>
            Sign in to browse all listings →
          </div>
        </div>

        {/* Right — form panel */}
        <div style={{
          borderLeft: '1px solid #E8E8E4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 56px',
          background: '#fff',
          overflowY: 'auto',
        }}>
          <div style={{ width: '100%', maxWidth: '340px' }}>

            {authError && (
              <p style={{
                marginBottom: '20px',
                padding: '10px 14px',
                border: '1px solid #ffc5c5',
                background: '#fff5f5',
                fontSize: '13px',
                color: '#cc2222',
              }}>
                That link has expired or already been used. Request a new one below.
              </p>
            )}

            {!sent ? (
              <>
                <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#999', marginBottom: '10px' }}>
                  Welcome back
                </div>
                <div style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: '6px', color: '#0a0a0a' }}>
                  Sign in
                </div>
                <div style={{ fontSize: '13px', color: '#999', marginBottom: '28px', lineHeight: 1.5 }}>
                  Continue with Google or get a magic link by email.
                </div>
                <div style={{ height: '1px', background: '#E8E8E4', marginBottom: '24px' }} />

                {/* Google */}
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  disabled={loading}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    padding: '12px 20px',
                    border: '1.5px solid #E8E8E4',
                    background: '#fff',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#0a0a0a',
                    marginBottom: '18px',
                    opacity: loading ? 0.5 : 1,
                    fontFamily: 'inherit',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
                    <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
                  </svg>
                  Continue with Google
                </button>

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                  <div style={{ flex: 1, height: '1px', background: '#E8E8E4' }} />
                  <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#999' }}>or</span>
                  <div style={{ flex: 1, height: '1px', background: '#E8E8E4' }} />
                </div>

                {/* Email form */}
                <form onSubmit={sendLink}>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '10px',
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: '#666',
                      marginBottom: '7px',
                    }}>
                      Email address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        border: '1.5px solid #E8E8E4',
                        background: '#fff',
                        fontSize: '13px',
                        color: '#0a0a0a',
                        outline: 'none',
                        fontFamily: 'inherit',
                        borderRadius: 0,
                        boxSizing: 'border-box',
                      }}
                      onFocus={e => (e.target.style.borderColor = '#0a0a0a')}
                      onBlur={e => (e.target.style.borderColor = '#E8E8E4')}
                    />
                  </div>

                  {error && (
                    <p style={{
                      marginBottom: '12px',
                      padding: '10px 14px',
                      border: '1px solid #ffc5c5',
                      background: '#fff5f5',
                      fontSize: '13px',
                      color: '#cc2222',
                    }}>
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !email}
                    style={{
                      width: '100%',
                      padding: '13px',
                      background: '#E8FF4D',
                      color: '#0a0a0a',
                      border: 'none',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      cursor: loading || !email ? 'not-allowed' : 'pointer',
                      opacity: loading || !email ? 0.5 : 1,
                      fontFamily: 'inherit',
                      marginTop: '4px',
                    }}
                  >
                    {loading ? 'Sending…' : 'Send sign-in link'}
                  </button>

                  {process.env.NODE_ENV === 'development' && (
                    <button
                      type="button"
                      onClick={devSignIn}
                      disabled={loading || !email}
                      style={{
                        width: '100%',
                        marginTop: '10px',
                        padding: '12px',
                        border: '1.5px dashed #FFB84D',
                        background: 'rgba(255,184,77,0.06)',
                        color: '#FFB84D',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: loading || !email ? 'not-allowed' : 'pointer',
                        opacity: loading || !email ? 0.5 : 1,
                        fontFamily: 'inherit',
                      }}
                    >
                      ⚡ Dev: sign in without email
                    </button>
                  )}
                </form>

                <div style={{ marginTop: '18px', fontSize: '11px', color: '#999', lineHeight: 1.7, textAlign: 'center' }}>
                  By signing in you agree to our{' '}
                  <Link href="/terms" style={{ color: '#0a0a0a', fontWeight: 600, textDecoration: 'none', borderBottom: '1px solid #E8E8E4' }}>Terms</Link>{' '}
                  and{' '}
                  <Link href="/privacy" style={{ color: '#0a0a0a', fontWeight: 600, textDecoration: 'none', borderBottom: '1px solid #E8E8E4' }}>Privacy Policy</Link>.
                  <br />New here? Creating an account is automatic.
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#999', marginBottom: '10px' }}>
                  Check your inbox
                </div>
                <div style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: '12px', color: '#0a0a0a' }}>
                  Link sent.
                </div>
                <div style={{ fontSize: '13px', color: '#999', marginBottom: '28px', lineHeight: 1.6 }}>
                  We sent a sign-in link to{' '}
                  <span style={{ color: '#0a0a0a', fontWeight: 600 }}>{email}</span>.
                  {' '}Click it to continue — expires in 1 hour.
                </div>
                <div style={{ height: '1px', background: '#E8E8E4', marginBottom: '24px' }} />
                <button
                  onClick={() => { setSent(false); setEmail(''); }}
                  style={{ background: 'none', border: 'none', fontSize: '13px', color: '#999', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
                >
                  ← Use a different email
                </button>
              </>
            )}
          </div>
        </div>
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
