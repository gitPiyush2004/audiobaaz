'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const CHECKLIST = [
  'Photo quality and angles complete',
  'No contact info visible in photos (phone, social, QR)',
  'Condition grade matches photos',
  'Declared inclusions visible in photos',
  'Price is reasonable for condition and model',
];

export function ReviewActions({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [checks, setChecks] = useState<boolean[]>(Array(CHECKLIST.length).fill(false));
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState('');

  const allChecked = checks.every(Boolean);

  async function submit(action: 'approved' | 'rejected') {
    if (action === 'rejected' && !reason.trim()) {
      setError('Rejection reason is required.');
      return;
    }
    setError('');
    setLoading(action === 'approved' ? 'approve' : 'reject');
    try {
      const res = await fetch(`/api/admin/listings/${listingId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: reason.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? 'Something went wrong.');
        return;
      }
      router.push('/admin/listings');
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 font-heading text-lg font-semibold text-foreground">Review Checklist</h2>
        <ul className="space-y-3">
          {CHECKLIST.map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <input
                type="checkbox"
                id={`check-${i}`}
                checked={checks[i]}
                onChange={(e) => {
                  const next = [...checks];
                  next[i] = e.target.checked;
                  setChecks(next);
                }}
                className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
              />
              <label htmlFor={`check-${i}`} className="cursor-pointer text-sm text-foreground">
                {item}
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <label className="mb-2 block text-sm font-medium text-foreground">
          Rejection reason <span className="text-text-2">(required if rejecting)</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="e.g. Photos too dark, condition grade seems inflated..."
          className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-text-2 focus:border-accent focus:outline-none"
        />
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={() => submit('approved')}
          disabled={!allChecked || loading !== null}
          className="flex-1 rounded-lg bg-accent py-2.5 text-sm font-semibold text-black transition-all hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading === 'approve' ? 'Approving…' : 'Approve'}
        </button>
        <button
          onClick={() => submit('rejected')}
          disabled={loading !== null}
          className="flex-1 rounded-lg border border-error py-2.5 text-sm font-semibold text-error transition-all hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading === 'reject' ? 'Rejecting…' : 'Reject'}
        </button>
      </div>

      {!allChecked && (
        <p className="text-center text-xs text-text-2">Complete all checklist items to approve.</p>
      )}
    </div>
  );
}
