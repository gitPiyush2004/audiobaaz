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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '14px', fontWeight: 600, color: '#0a0a0a' }}>{upi}</span>
        <button
          onClick={() => setEditing(true)}
          style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#666', border: '1px solid #E8E8E4', padding: '5px 14px', background: 'none', cursor: 'pointer' }}
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <input
        type="text"
        value={upi}
        onChange={e => setUpi(e.target.value)}
        placeholder="yourname@upi"
        style={{ width: '100%', border: '1.5px solid #E8E8E4', padding: '10px 14px', fontFamily: 'var(--font-mono, monospace)', fontSize: '13px', color: '#0a0a0a', outline: 'none', background: '#fff' }}
        onFocus={e => (e.target.style.borderColor = '#0a0a0a')}
        onBlur={e => (e.target.style.borderColor = '#E8E8E4')}
      />
      {error && <p style={{ fontSize: '11px', color: '#B91C1C' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={save}
          disabled={saving || !upi.trim()}
          style={{ background: '#E8FF4D', color: '#0a0a0a', border: 'none', padding: '10px 24px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', opacity: (saving || !upi.trim()) ? 0.4 : 1 }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {currentUpi && (
          <button
            onClick={() => { setEditing(false); setUpi(currentUpi); }}
            style={{ background: 'none', color: '#666', border: '1px solid #E8E8E4', padding: '10px 24px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
