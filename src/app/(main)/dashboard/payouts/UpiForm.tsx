'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function UpiForm({ currentUpi }: { currentUpi: string | null }) {
  const [upi, setUpi]       = useState(currentUpi ?? '');
  const [editing, setEditing] = useState(!currentUpi);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const router = useRouter();

  async function save() {
    setSaving(true);
    setError(null);
    const res  = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upi_id: upi }),
    });
    const json = await res.json();
    if (json.error) setError(json.error.message);
    else { setEditing(false); router.refresh(); }
    setSaving(false);
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono text-sm text-foreground">{upi}</span>
        <button
          onClick={() => setEditing(true)}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={upi}
        onChange={e => setUpi(e.target.value)}
        placeholder="yourname@upi"
        className="w-full rounded-lg border border-border bg-surface-2 px-4 py-2.5 font-mono text-sm text-foreground placeholder:text-dim-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
      />
      {error && <p className="text-xs text-error">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving || !upi.trim()}
          className="h-9 rounded-lg bg-accent px-5 text-sm font-semibold text-black transition-all hover:bg-accent-hover disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {currentUpi && (
          <button
            onClick={() => { setEditing(false); setUpi(currentUpi); }}
            className="h-9 rounded-lg border border-border px-5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
