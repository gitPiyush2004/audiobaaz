'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const inputCls = [
  'w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground',
  'placeholder:text-dim-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors',
].join(' ');

const labelCls = 'mb-1.5 block text-sm font-medium text-foreground';

function OnboardingForm() {
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [phone,     setPhone]     = useState('');
  const [telegram,  setTelegram]  = useState('');
  const [city,      setCity]      = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const searchParams = useSearchParams();
  const next        = searchParams.get('next') ?? '/';

  const phoneDigits = phone.replace(/\D/g, '');
  const canSubmit   = firstName.trim() && lastName.trim() && phoneDigits.length === 10 && city.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);

    const body: Record<string, string> = {
      full_name: `${firstName.trim()} ${lastName.trim()}`,
      phone:     `+91${phoneDigits}`,
      city:      city.trim(),
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

    // Full reload so the Nav server component re-fetches the updated profile.
    window.location.href = next;
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        <div className="mb-8 text-center">
          <Link href="/" className="font-heading text-xl font-bold text-foreground">
            audio<span className="text-accent">baaz</span>
          </Link>
          <h1 className="mt-6 font-heading text-2xl font-bold text-foreground">
            Complete your profile
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Just a few details before you dive in.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>First name</label>
              <input
                type="text"
                required
                autoFocus
                placeholder="Bhavit"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Last name</label>
              <input
                type="text"
                required
                placeholder="Virmani"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Phone number</label>
            <div className="flex">
              <span className="inline-flex items-center rounded-l-lg border border-r-0 border-border bg-surface-2 px-4 text-sm text-muted-foreground select-none">
                +91
              </span>
              <input
                type="tel"
                required
                maxLength={10}
                placeholder="9876543210"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className={[inputCls, 'rounded-l-none'].join(' ')}
              />
            </div>
            {phone && phoneDigits.length !== 10 && (
              <p className="mt-1 text-xs text-error">Enter a 10-digit number</p>
            )}
          </div>

          <div>
            <label className={labelCls}>
              Telegram username{' '}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <div className="flex">
              <span className="inline-flex items-center rounded-l-lg border border-r-0 border-border bg-surface-2 px-4 text-sm text-muted-foreground select-none">
                @
              </span>
              <input
                type="text"
                placeholder="yourusername"
                value={telegram}
                onChange={e => setTelegram(e.target.value.replace(/^@/, ''))}
                className={[inputCls, 'rounded-l-none'].join(' ')}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Used to send you order updates and listing notifications.
            </p>
          </div>

          <div>
            <label className={labelCls}>City</label>
            <input
              type="text"
              required
              placeholder="Mumbai"
              value={city}
              onChange={e => setCity(e.target.value)}
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
            disabled={!canSubmit || loading}
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-accent text-sm font-semibold text-black transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? 'Saving…' : 'Continue'}
          </button>

        </form>
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
