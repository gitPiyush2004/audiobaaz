'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function PayoutTrigger({ orderId, upiId }: { orderId: string; upiId: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function trigger() {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/payouts/${orderId}/trigger`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) { setError(json.error?.message ?? 'Something went wrong.'); return; }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (!upiId) {
    return <span className="text-xs text-error">No UPI ID</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={trigger}
        disabled={loading}
        className="rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-black transition-all hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? 'Sending…' : 'Trigger payout'}
      </button>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
