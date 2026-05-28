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
      className="rounded-md border border-error/30 px-3 py-1 text-xs text-error transition-colors hover:bg-error/10 disabled:opacity-50"
    >
      {loading ? '…' : 'Delist'}
    </button>
  );
}
