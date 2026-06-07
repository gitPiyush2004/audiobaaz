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
      style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#0a0a0a', background: '#E8FF4D', border: 'none', padding: '3px 10px', cursor: 'pointer', opacity: loading ? 0.5 : 1 }}
    >
      {loading ? '…' : 'Edit & resubmit'}
    </button>
  );
}
