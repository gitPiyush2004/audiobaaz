'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatPrice } from '@/lib/utils/formatting';

function parseRupees(raw: string): number | null {
  const n = parseFloat(raw.replace(/,/g, ''));
  if (isNaN(n) || n <= 0) return null;
  return Math.floor(n * 100);
}

export function PriceEdit({
  listingId,
  currentPricePaise,
}: {
  listingId: string;
  currentPricePaise: number;
}) {
  const [editing, setEditing] = useState(false);
  const [value,   setValue]   = useState((currentPricePaise / 100).toString());
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const router = useRouter();

  async function save() {
    const paise = parseRupees(value);
    if (!paise) { setError('Enter a valid price'); return; }
    setSaving(true);
    setError(null);
    const res  = await fetch(`/api/listings/${listingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asking_price: paise }),
    });
    const json = await res.json();
    if (json.error) setError(json.error.message);
    else { setEditing(false); router.refresh(); }
    setSaving(false);
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-sm font-semibold text-foreground">
          {formatPrice(currentPricePaise)}
        </span>
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-dim-foreground transition-colors hover:text-muted-foreground"
          title="Edit price"
        >
          ✎
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-xs text-muted-foreground">₹</span>
        <input
          type="number"
          min={1}
          autoFocus
          value={value}
          onChange={e => { setValue(e.target.value); setError(null); }}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          className="w-24 rounded-md border border-accent bg-surface-2 px-2 py-1 font-mono text-sm text-foreground focus:outline-none"
        />
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-accent px-2 py-1 text-xs font-semibold text-black disabled:opacity-50"
        >
          {saving ? '…' : 'Save'}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
