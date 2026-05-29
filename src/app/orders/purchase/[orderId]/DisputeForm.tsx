'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const REASONS = [
  { value: 'condition_mismatch', label: 'Condition does not match listing' },
  { value: 'non_functional',     label: 'Item is non-functional' },
  { value: 'missing_accessory',  label: 'Accessory missing from listing' },
  { value: 'not_received',       label: 'Item not received' },
  { value: 'wrong_item',         label: 'Wrong item sent' },
] as const;

const inputCls = 'w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors';

export function DisputeForm({ orderId }: { orderId: string }) {
  const [open,        setOpen]        = useState(false);
  const [reason,      setReason]      = useState('');
  const [description, setDescription] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res  = await fetch('/api/disputes', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ order_id: orderId, reason, description }),
    });
    const json = await res.json();

    if (json.error) { setError(json.error.message); setLoading(false); return; }
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-error/40 bg-error/5 text-sm font-medium text-error transition-colors hover:bg-error/10"
      >
        Raise a dispute
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-error/30 bg-error/5 p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-foreground">Raise a dispute</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Describe the issue. Our team will review and respond within 24 hours.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Reason</label>
          <select
            required
            value={reason}
            onChange={e => setReason(e.target.value)}
            className={inputCls}
          >
            <option value="">Select a reason…</option>
            {REASONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Description</label>
          <textarea
            required
            rows={4}
            placeholder="Describe the issue in detail…"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className={[inputCls, 'resize-none'].join(' ')}
          />
        </div>

        {error && (
          <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex-1 h-11 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!reason || !description.trim() || loading}
            className="flex-1 h-11 rounded-xl bg-error text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Submitting…' : 'Submit dispute'}
          </button>
        </div>
      </form>
    </div>
  );
}
