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
      style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#666', border: '1px solid #E8E8E4', padding: '3px 10px', background: 'none', cursor: 'pointer', opacity: loading ? 0.5 : 1 }}
    >
      {loading ? '…' : 'Pull back'}
    </button>
  );
}
