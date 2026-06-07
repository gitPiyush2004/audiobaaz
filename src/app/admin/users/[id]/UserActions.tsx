'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Action = 'suspend' | 'reactivate' | 'strike' | 'promote';

export function UserActions({
  userId,
  isActive,
  isAdmin,
  strikeCount,
}: {
  userId: string;
  isActive: boolean;
  isAdmin: boolean;
  strikeCount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<Action | null>(null);
  const [error, setError] = useState('');

  async function perform(action: Action) {
    setError('');
    setLoading(action);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error?.message ?? 'Something went wrong.'); return; }
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h2 className="mb-4 font-heading text-lg font-semibold text-foreground">Actions</h2>

      <div className="space-y-3">
        {isActive ? (
          <button
            onClick={() => perform('suspend')}
            disabled={loading !== null}
            className="w-full rounded-lg border border-error py-2.5 text-sm font-semibold text-error transition-all hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading === 'suspend' ? 'Suspending…' : 'Suspend account'}
          </button>
        ) : (
          <button
            onClick={() => perform('reactivate')}
            disabled={loading !== null}
            className="w-full rounded-lg border border-success py-2.5 text-sm font-semibold text-success transition-all hover:bg-success/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading === 'reactivate' ? 'Reactivating…' : 'Reactivate account'}
          </button>
        )}

        <button
          onClick={() => perform('strike')}
          disabled={loading !== null}
          className="w-full rounded-lg border border-warning py-2.5 text-sm font-semibold text-warning transition-all hover:bg-warning/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading === 'strike' ? 'Adding…' : `Add strike (current: ${strikeCount})`}
        </button>

        {!isAdmin && (
          <button
            onClick={() => perform('promote')}
            disabled={loading !== null}
            className="w-full rounded-lg border border-accent py-2.5 text-sm font-semibold text-accent transition-all hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading === 'promote' ? 'Promoting…' : 'Promote to admin'}
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-error">{error}</p>}
    </div>
  );
}
