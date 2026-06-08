'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePincodeLookup } from '@/hooks/usePincodeLookup';

interface Profile {
  full_name:        string | null;
  phone:            string | null;
  city:             string | null;
  pincode:          string | null;
  availability:     string | null;
  telegram_chat_id: string | null;
}

const inputCls = [
  'w-full rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm text-foreground',
  'placeholder:text-dim-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors',
].join(' ');

export function AccountForm({ profile, email }: { profile: Profile | null; email: string }) {
  const [form, setForm] = useState({
    full_name:    profile?.full_name    ?? '',
    phone:        profile?.phone        ?? '',
    city:         profile?.city         ?? '',
    pincode:      profile?.pincode      ?? '',
    availability: profile?.availability ?? 'active',
  });
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const router = useRouter();
  const { lookup, loading: pincodeLoading } = usePincodeLookup();

  function set(key: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
    setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res  = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (json.error) setError(json.error.message);
    else { setSuccess(true); router.refresh(); }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Full name</label>
          <input type="text" placeholder="Your name" value={form.full_name}
            onChange={e => set('full_name', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
          <input type="email" value={email} disabled
            className={inputCls + ' opacity-50 cursor-not-allowed'} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Phone</label>
          <input type="tel" placeholder="+91 98765 43210" value={form.phone}
            onChange={e => set('phone', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            City {pincodeLoading && <span className="text-xs text-muted-foreground">(looking up…)</span>}
          </label>
          <input type="text" placeholder="Mumbai" value={form.city}
            onChange={e => set('city', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Pincode</label>
          <input type="text" placeholder="400001" maxLength={6} value={form.pincode}
            onChange={async e => {
              const val = e.target.value.replace(/\D/g, '');
              set('pincode', val);
              if (val.length === 6) {
                const result = await lookup(val);
                if (result) {
                  setForm(prev => ({
                    ...prev,
                    city: prev.city || result.city,
                  }));
                }
              }
            }}
            className={inputCls + ' font-mono'} />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Availability</label>
        <select value={form.availability} onChange={e => set('availability', e.target.value)}
          className={inputCls}>
          <option value="active">Active — accepting offers</option>
          <option value="away">Away — not accepting offers</option>
          <option value="paused">Paused — listings hidden</option>
        </select>
      </div>

      {profile?.telegram_chat_id ? (
        <div className="rounded-lg border border-border bg-surface-2 px-4 py-3">
          <p className="text-xs text-muted-foreground">Telegram connected</p>
          <p className="mt-0.5 text-sm text-foreground font-mono">{profile.telegram_chat_id}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Telegram not connected. Message{' '}
            <span className="text-accent">@audiobaaz_bot</span> to link your account
            and receive notifications.
          </p>
        </div>
      )}

      {error   && <p className="text-sm text-error">{error}</p>}
      {success && <p className="text-sm text-success">Saved successfully.</p>}

      <button
        type="submit"
        disabled={saving}
        className="h-10 rounded-lg bg-accent px-6 text-sm font-semibold text-black transition-all hover:bg-accent-hover disabled:opacity-40"
      >
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}
