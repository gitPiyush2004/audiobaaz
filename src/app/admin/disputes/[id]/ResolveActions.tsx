'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Resolution = 'full_refund' | 'partial_refund' | 'rejected';

const options: { value: Resolution; label: string; description: string }[] = [
  { value: 'full_refund',     label: 'Full refund',     description: 'Refund buyer in full. Seller receives no payout.' },
  { value: 'partial_refund',  label: 'Partial refund',  description: 'Refund a specified amount. Seller keeps the rest.' },
  { value: 'rejected',        label: 'Reject dispute',  description: 'Release escrow to seller. Buyer gets nothing.' },
];

export function ResolveActions({ disputeId, paidPrice }: { disputeId: string; paidPrice: number }) {
  const router = useRouter();
  const [resolution, setResolution] = useState<Resolution>('full_refund');
  const [refundPaise, setRefundPaise] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!adminNotes.trim()) { setError('Admin notes are required.'); return; }
    if (resolution === 'partial_refund') {
      const amt = parseInt(refundPaise, 10);
      if (!amt || amt <= 0 || amt >= paidPrice) {
        setError('Enter a valid partial refund amount (in ₹), less than the paid price.');
        return;
      }
    }
    setError('');
    setLoading(true);
    try {
      const refundAmountPaise = resolution === 'full_refund'
        ? paidPrice
        : resolution === 'partial_refund'
        ? parseInt(refundPaise, 10) * 100
        : 0;

      const res = await fetch(`/api/admin/disputes/${disputeId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution, refund_amount: refundAmountPaise, admin_notes: adminNotes.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error?.message ?? 'Something went wrong.'); return; }
      router.push('/admin/disputes');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 font-heading text-lg font-semibold text-foreground">Resolution</h2>

        <div className="space-y-2">
          {options.map((opt) => (
            <label
              key={opt.value}
              className={[
                'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                resolution === opt.value ? 'border-accent bg-surface-2' : 'border-border hover:bg-surface-2',
              ].join(' ')}
            >
              <input
                type="radio"
                name="resolution"
                value={opt.value}
                checked={resolution === opt.value}
                onChange={() => setResolution(opt.value)}
                className="mt-0.5 accent-accent"
              />
              <div>
                <p className="text-sm font-medium text-foreground">{opt.label}</p>
                <p className="text-xs text-text-2">{opt.description}</p>
              </div>
            </label>
          ))}
        </div>

        {resolution === 'partial_refund' && (
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-foreground">
              Refund amount (₹)
            </label>
            <input
              type="number"
              value={refundPaise}
              onChange={(e) => setRefundPaise(e.target.value)}
              placeholder="e.g. 2000"
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-text-2 focus:border-accent focus:outline-none"
            />
            <p className="mt-1 text-xs text-text-2">Enter in rupees — stored internally as paise.</p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <label className="mb-2 block text-sm font-medium text-foreground">
          Admin notes <span className="text-error">*</span>
        </label>
        <textarea
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          rows={3}
          placeholder="Summarise your decision..."
          className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-text-2 focus:border-accent focus:outline-none"
        />
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <button
        onClick={submit}
        disabled={loading}
        className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-black transition-all hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? 'Resolving…' : 'Resolve dispute'}
      </button>
    </div>
  );
}
