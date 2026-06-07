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
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '14px', fontWeight: 800, letterSpacing: '-0.02em' }}>
          {formatPrice(currentPricePaise)}
        </span>
        <button
          onClick={() => setEditing(true)}
          style={{ fontSize: '12px', color: '#999', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
          title="Edit price"
        >
          ✎
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ fontSize: '12px', color: '#999' }}>₹</span>
        <input
          type="number"
          min={1}
          autoFocus
          value={value}
          onChange={e => { setValue(e.target.value); setError(null); }}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          style={{ width: '80px', border: '1.5px solid #E8FF4D', padding: '3px 6px', fontFamily: 'var(--font-mono, monospace)', fontSize: '13px', outline: 'none' }}
        />
        <button
          onClick={save}
          disabled={saving}
          style={{ background: '#E8FF4D', color: '#0a0a0a', border: 'none', padding: '3px 8px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
        >
          {saving ? '…' : 'Save'}
        </button>
        <button
          onClick={() => setEditing(false)}
          style={{ fontSize: '12px', color: '#999', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>
      {error && <p style={{ fontSize: '10px', color: '#B91C1C' }}>{error}</p>}
    </div>
  );
}
