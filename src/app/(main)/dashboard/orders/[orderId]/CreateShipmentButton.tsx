'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  orderId: string;
}

export function CreateShipmentButton({ orderId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/shipping/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId }),
      });
      const json = await res.json();
      if (json.error) {
        setError(json.error.message);
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex h-10 items-center justify-center rounded-lg bg-accent px-5 text-sm font-semibold text-black transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? 'Booking shipment…' : 'Create shipment'}
      </button>
      {error && (
        <p className="mt-2 text-xs text-error">{error}</p>
      )}
    </div>
  );
}
