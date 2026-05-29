'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ResubmitButton({ listingId }: { listingId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleResubmit() {
    setLoading(true);
    await fetch(`/api/listings/${listingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'draft' }),
    });
    router.push(`/sell/draft/${listingId}`);
  }

  return (
    <button
      onClick={handleResubmit}
      disabled={loading}
      className="rounded-md border border-accent/40 bg-accent/5 px-3 py-1 text-xs text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
    >
      {loading ? '…' : 'Edit & resubmit'}
    </button>
  );
}
