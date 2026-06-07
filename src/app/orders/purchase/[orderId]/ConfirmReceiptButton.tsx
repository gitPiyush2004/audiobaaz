'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ConfirmReceiptButton({ orderId }: { orderId: string }) {
  const [loading,     setLoading]     = useState(false);
  const [confirmed,   setConfirmed]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const router = useRouter();

  async function handleConfirm() {
    if (!window.confirm('Confirm that you received the item in the described condition? This will release payment to the seller.')) return;
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/orders/${orderId}/complete`, { method: 'POST' });
      const json = await res.json();
      if (json.error) {
        setError(json.error.message);
        setLoading(false);
        return;
      }
      setConfirmed(true);
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  if (confirmed) {
    return (
      <p className="text-sm font-medium text-success">Receipt confirmed — payment released to seller.</p>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleConfirm}
        disabled={loading}
        className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Confirming…' : 'Confirm receipt'}
      </button>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
