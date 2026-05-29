'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function PullBackButton({ listingId }: { listingId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handlePullBack() {
    if (!confirm('Pull this listing back to drafts? It will be removed from the review queue.')) return;
    setLoading(true);
    await fetch(`/api/listings/${listingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'draft' }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      onClick={handlePullBack}
      disabled={loading}
      className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-border-2 hover:text-foreground disabled:opacity-50"
    >
      {loading ? '…' : 'Pull back'}
    </button>
  );
}
