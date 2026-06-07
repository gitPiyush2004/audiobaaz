'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Logo } from '@/components/layout/Logo';

const font = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const serif = '"Instrument Serif", Georgia, serif';

const border = '1.5px solid #E8E8E4';
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  border,
  background: '#fff',
  fontSize: '13px',
  color: '#0a0a0a',
  outline: 'none',
  fontFamily: 'inherit',
  borderRadius: 0,
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};

function StepDot({ state, label }: { state: 'done' | 'active' | 'pending'; label: string }) {
  const bg = state === 'done' ? '#E8FF4D' : state === 'active' ? '#fff' : '#1a1a1a';
  const color = state === 'done' || state === 'active' ? '#0a0a0a' : '#444';
  const border = state === 'pending' ? '1px solid #2a2a2a' : 'none';
  return (
    <div style={{
      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: bg, color, border, fontSize: '11px', fontWeight: 700,
      marginTop: 1,
    }}>
      {state === 'done' ? '✓' : label}
    </div>
  );
}

function OnboardingForm() {
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [phone,     setPhone]     = useState('');
  const [telegram,  setTelegram]  = useState('');
  const [pincode,   setPincode]   = useState('');
  const [resolvedCity,  setResolvedCity]  = useState('');
  const [resolvedState, setResolvedState] = useState('');
  const [pincodeError,  setPincodeError]  = useState('');
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/';

  const phoneDigits = phone.replace(/\D/g, '');
  const canSubmit = firstName.trim() && lastName.trim() && phoneDigits.length === 10 && resolvedCity;

  // Auto-lookup when pincode reaches 6 digits
  const lookupRef = useRef<AbortController | null>(null);
  useEffect(() => {
    if (pincode.length !== 6) {
      setResolvedCity('');
      setResolvedState('');
      setPincodeError('');
      return;
    }
    lookupRef.current?.abort();
    const ctrl = new AbortController();
    lookupRef.current = ctrl;
    setPincodeLoading(true);
    setPincodeError('');
    fetch(`/api/pincode/${pincode}`, { signal: ctrl.signal })
      .then(r => r.json())
      .then(data => {
        if (data.city) {
          setResolvedCity(data.city);
          setResolvedState(data.state ?? '');
        } else {
          setResolvedCity('');
          setResolvedState('');
          setPincodeError('Pincode not found — check and try again.');
        }
      })
      .catch(() => {/* aborted */})
      .finally(() => setPincodeLoading(false));
  }, [pincode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);

    const body: Record<string, string> = {
      full_name: `${firstName.trim()} ${lastName.trim()}`,
      phone:     `+91${phoneDigits}`,
      city:      resolvedCity,
      pincode,
    };
    const handle = telegram.trim().replace(/^@/, '');
    if (handle) body.telegram_chat_id = handle;

    const res  = await fetch('/api/users/me', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    const json = await res.json();

    if (json.error) {
      setError(
        json.error.code === '23505'
          ? 'That phone number is already linked to another account.'
          : json.error.message,
      );
      setLoading(false);
      return;
    }

    window.location.href = next;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#fff', fontFamily: font }}>

      {/* Nav */}
      <nav style={{
        height: 60, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px',
        borderBottom: '1px solid #E8E8E4',
        background: '#fff',
        zIndex: 10,
      }}>
        <Logo size={36} />
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#999' }}>
          Step 1 of 1 — Profile setup
        </span>
      </nav>

      {/* Two-column body */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>

        {/* Left — dark brand panel */}
        <div style={{
          background: '#0a0a0a',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: '64px 56px',
          position: 'relative', overflow: 'hidden',
        }}>

          {/* Vinyl rings watermark */}
          <svg
            viewBox="0 0 500 500"
            xmlns="http://www.w3.org/2000/svg"
            style={{ position: 'absolute', bottom: -160, right: -160, width: 500, height: 500, opacity: 0.035, pointerEvents: 'none' }}
            aria-hidden
          >
            {[240, 215, 190, 165, 140, 115, 90, 65].map((r, i) => (
              <circle key={i} cx="250" cy="250" r={r} fill="none" stroke="white" strokeWidth={i % 2 === 0 ? 1.5 : 1.2} />
            ))}
          </svg>

          {/* Headline */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: '#3a3a3a', marginBottom: 20,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', flexShrink: 0, display: 'inline-block' }} />
              One-time setup
            </div>
            <div style={{ fontSize: 'clamp(32px,3.5vw,46px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 0.92, color: '#fff', marginBottom: 20 }}>
              Almost there.
              <br />
              <span style={{ fontFamily: serif, fontStyle: 'italic', fontWeight: 400, color: '#E8FF4D', display: 'block', marginTop: 4 }}>
                Just a few details.
              </span>
            </div>
            <p style={{ fontSize: 14, color: '#3a3a3a', lineHeight: 1.7, maxWidth: 320 }}>
              Tell us a bit about yourself so buyers and sellers can connect. This takes less than 2 minutes.
            </p>
          </div>

          {/* Step progress */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            {[
              { state: 'done'    as const, num: '1', name: 'Sign in',          desc: 'Google or email — done.' },
              { state: 'active'  as const, num: '2', name: 'Complete profile', desc: 'Name, phone, city. Takes 2 minutes.' },
              { state: 'pending' as const, num: '3', name: 'Start browsing',   desc: 'Buy and sell verified gear.' },
            ].map(({ state, num, name, desc }, i, arr) => (
              <div key={num} style={{
                display: 'flex', alignItems: 'flex-start', gap: 16,
                padding: '18px 0',
                borderBottom: i < arr.length - 1 ? '1px solid #161616' : 'none',
              }}>
                <StepDot state={state} label={num} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: state === 'pending' ? '#333' : '#fff', marginBottom: 2 }}>{name}</div>
                  <div style={{ fontSize: 11, color: state === 'pending' ? '#2a2a2a' : '#333', lineHeight: 1.4 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — form */}
        <div style={{
          borderLeft: '1px solid #E8E8E4',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 64px',
          background: '#fff',
          overflowY: 'auto',
        }}>
          <div style={{ width: '100%', maxWidth: 420 }}>

            <div style={{ marginBottom: 36 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#999', marginBottom: 10 }}>
                Profile setup
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 6, color: '#0a0a0a' }}>
                Complete your profile
              </div>
              <div style={{ fontSize: 13, color: '#999', lineHeight: 1.5 }}>
                Just a few details before you dive in.
              </div>
            </div>

            <form onSubmit={handleSubmit}>

              {/* Name row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                {[
                  { label: 'First name', value: firstName, set: setFirstName, placeholder: 'Rohan', auto: 'given-name' },
                  { label: 'Last name',  value: lastName,  set: setLastName,  placeholder: 'Kapoor', auto: 'family-name' },
                ].map(({ label, value, set, placeholder, auto }) => (
                  <div key={label}>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#666', marginBottom: 7 }}>
                      {label}
                    </label>
                    <input
                      type="text"
                      required
                      autoComplete={auto}
                      placeholder={placeholder}
                      value={value}
                      onChange={e => set(e.target.value)}
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = '#0a0a0a')}
                      onBlur={e => (e.target.style.borderColor = '#E8E8E4')}
                    />
                  </div>
                ))}
              </div>

              {/* Phone */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#666', marginBottom: 7 }}>
                  Phone number
                </label>
                <div style={{ display: 'flex' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 14px', background: '#FAFAF8',
                    border: '1.5px solid #E8E8E4', borderRight: 'none',
                    fontSize: 13, fontWeight: 600, color: '#666',
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    +91
                  </div>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    autoComplete="tel-national"
                    placeholder="98765 43210"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = '#0a0a0a')}
                    onBlur={e => (e.target.style.borderColor = '#E8E8E4')}
                  />
                </div>
                {phone && phoneDigits.length !== 10 && (
                  <p style={{ marginTop: 6, fontSize: 11, color: '#B91C1C' }}>Enter a 10-digit number</p>
                )}
              </div>

              {/* Telegram */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#666', marginBottom: 7 }}>
                  Telegram username <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11, color: '#999' }}>(optional)</span>
                </label>
                <div style={{ display: 'flex' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 14px', background: '#FAFAF8',
                    border: '1.5px solid #E8E8E4', borderRight: 'none',
                    fontSize: 13, fontWeight: 600, color: '#999',
                    flexShrink: 0,
                  }}>
                    @
                  </div>
                  <input
                    type="text"
                    placeholder="yourusername"
                    value={telegram}
                    onChange={e => setTelegram(e.target.value.replace(/^@/, ''))}
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = '#0a0a0a')}
                    onBlur={e => (e.target.style.borderColor = '#E8E8E4')}
                  />
                </div>
                <p style={{ marginTop: 6, fontSize: 11, color: '#999', lineHeight: 1.5 }}>
                  Used to send you order updates and listing notifications.
                </p>
              </div>

              {/* Pincode */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#666', marginBottom: 7 }}>
                  Pincode
                </label>
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="110001"
                  value={pincode}
                  onChange={e => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = '#0a0a0a')}
                  onBlur={e => (e.target.style.borderColor = '#E8E8E4')}
                />
                {pincodeLoading && (
                  <p style={{ marginTop: 6, fontSize: 11, color: '#999' }}>Looking up…</p>
                )}
                {resolvedCity && !pincodeLoading && (
                  <div style={{
                    marginTop: 8, padding: '8px 12px',
                    background: '#F5FFF5', border: '1px solid #bbf7d0',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#15803D', flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ fontSize: 12, color: '#15803D', fontWeight: 600 }}>
                      {resolvedCity}{resolvedState ? `, ${resolvedState}` : ''}
                    </span>
                  </div>
                )}
                {pincodeError && (
                  <p style={{ marginTop: 6, fontSize: 11, color: '#B91C1C' }}>{pincodeError}</p>
                )}
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: '#E8E8E4', margin: '24px 0' }} />

              {error && (
                <div style={{
                  marginBottom: 16, padding: '10px 14px',
                  border: '1px solid #ffc5c5', background: '#fff5f5',
                  fontSize: 13, color: '#cc2222',
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit || loading}
                style={{
                  width: '100%', padding: '14px',
                  background: '#E8FF4D', color: '#0a0a0a', border: 'none',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                  cursor: !canSubmit || loading ? 'not-allowed' : 'pointer',
                  opacity: !canSubmit || loading ? 0.5 : 1,
                  fontFamily: 'inherit',
                  transition: 'opacity 0.15s',
                }}
              >
                {loading ? 'Saving…' : 'Continue →'}
              </button>

              <p style={{ marginTop: 16, fontSize: 11, color: '#999', textAlign: 'center', lineHeight: 1.6 }}>
                Your information is only used to facilitate transactions.<br />
                We never share it with third parties.
              </p>

            </form>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingForm />
    </Suspense>
  );
}
