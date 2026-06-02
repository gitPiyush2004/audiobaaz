'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function OfferActions({ offerId }: { offerId: string }) {
  const [loading, setLoading] = useState<'accept' | 'decline' | null>(null);
  const router = useRouter();

  async function handle(action: 'accept' | 'decline') {
    setLoading(action);
    await fetch(`/api/offers/${offerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    router.refresh();
    setLoading(null);
  }

  return (
    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
      <button
        disabled={!!loading}
        onClick={() => handle('accept')}
        style={{ background: '#E8FF4D', color: '#0a0a0a', border: 'none', padding: '10px 20px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', opacity: !!loading ? 0.5 : 1 }}
      >
        {loading === 'accept' ? '…' : 'Accept'}
      </button>
      <button
        disabled={!!loading}
        onClick={() => handle('decline')}
        style={{ background: '#fff', color: '#B91C1C', border: '1px solid #FECACA', padding: '10px 20px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', opacity: !!loading ? 0.5 : 1 }}
      >
        {loading === 'decline' ? '…' : 'Decline'}
      </button>
    </div>
  );
}
