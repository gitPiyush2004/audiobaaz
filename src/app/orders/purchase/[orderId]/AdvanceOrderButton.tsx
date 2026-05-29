'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AdvanceOrderButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function advance() {
    setLoading(true);
    await fetch('/api/dev/advance-order', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ order_id: orderId }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      onClick={advance}
      disabled={loading}
      className="w-full rounded-lg border border-warning/40 bg-warning/10 px-4 py-2 text-sm font-medium text-warning transition-colors hover:bg-warning/20 disabled:opacity-50"
    >
      {loading ? 'Advancing…' : 'Advance to inspection (skip shipping)'}
    </button>
  );
}
