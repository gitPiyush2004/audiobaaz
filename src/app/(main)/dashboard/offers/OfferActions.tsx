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
    <div className="flex shrink-0 gap-2">
      <button
        disabled={!!loading}
        onClick={() => handle('accept')}
        className="h-9 rounded-lg border border-success/30 bg-success/10 px-4 text-sm font-medium text-success transition-colors hover:bg-success/20 disabled:opacity-50"
      >
        {loading === 'accept' ? '…' : 'Accept'}
      </button>
      <button
        disabled={!!loading}
        onClick={() => handle('decline')}
        className="h-9 rounded-lg border border-error/30 bg-error/10 px-4 text-sm font-medium text-error transition-colors hover:bg-error/20 disabled:opacity-50"
      >
        {loading === 'decline' ? '…' : 'Decline'}
      </button>
    </div>
  );
}
