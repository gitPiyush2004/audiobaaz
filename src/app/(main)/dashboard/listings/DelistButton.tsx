'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DelistButton({ listingId }: { listingId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelist() {
    if (!confirm('Delist this listing? It will be removed from the marketplace.')) return;
    setLoading(true);
    await fetch(`/api/listings/${listingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'delisted' }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      onClick={handleDelist}
      disabled={loading}
      style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B91C1C', border: '1px solid #FECACA', padding: '3px 10px', background: 'none', cursor: 'pointer', opacity: loading ? 0.5 : 1 }}
    >
      {loading ? '…' : 'Delist'}
    </button>
  );
}
