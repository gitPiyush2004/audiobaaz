'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  awb: string;
  currentStatus: string;
}

const NEXT_STATUS: Record<string, string | null> = {
  created:          'picked_up',
  picked_up:        'in_transit',
  in_transit:       'out_for_delivery',
  out_for_delivery: 'delivered',
};

const LABEL: Record<string, string> = {
  picked_up:        'Mark picked up',
  in_transit:       'Mark in transit',
  out_for_delivery: 'Mark out for delivery',
  delivered:        'Mark delivered',
};

export function AdvanceShipmentButton({ awb, currentStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const next = NEXT_STATUS[currentStatus];
  if (!next) {
    return (
      <p className="text-xs text-muted-foreground">No further mock-shipment transitions from {currentStatus}.</p>
    );
  }

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dev/shipping/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ awb, to_status: next }),
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
        className="inline-flex h-9 items-center justify-center rounded-md bg-warning/20 px-4 text-xs font-semibold text-warning transition-colors hover:bg-warning/30 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? 'Advancing…' : LABEL[next!]}
      </button>
      {error && (
        <p className="mt-2 text-xs text-error">{error}</p>
      )}
    </div>
  );
}
