'use client';

import { useState } from 'react';

function fmt(n: number) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

export function PayoutCalculator() {
  const [raw, setRaw] = useState('10000');
  const price  = parseFloat(raw.replace(/,/g, '')) || 0;
  const fee    = Math.round(price * 0.1);
  const payout = price - fee;

  const font = '"Helvetica Neue", Helvetica, Arial, sans-serif';

  return (
    <div style={{ width: '100%', maxWidth: '340px', fontFamily: font }}>
      <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#444', marginBottom: '20px' }}>
        Live payout calculator
      </div>

      <div style={{ marginBottom: '28px' }}>
        <span style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#444', marginBottom: '8px' }}>
          Your listing price
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <span style={{ fontSize: '22px', fontWeight: 700, color: '#555', paddingRight: '6px' }}>₹</span>
          <input
            type="number"
            min="0"
            value={raw}
            onChange={e => setRaw(e.target.value)}
            placeholder="10,000"
            style={{
              fontFamily: font,
              fontSize: '28px',
              fontWeight: 900,
              color: '#fff',
              background: 'transparent',
              border: 'none',
              borderBottom: '2px solid #333',
              outline: 'none',
              width: '100%',
              letterSpacing: '-0.04em',
              paddingBottom: '4px',
            }}
            onFocus={e => (e.target.style.borderBottomColor = '#E8FF4D')}
            onBlur={e => (e.target.style.borderBottomColor = '#333')}
          />
        </div>
      </div>

      <div style={{ borderTop: '1px solid #1a1a1a', padding: '14px 0', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: '12px', color: '#555' }}>Platform fee (10%)</span>
        <span style={{ fontSize: '14px', fontWeight: 700, color: '#E24B4A', letterSpacing: '-0.02em' }}>− {fmt(fee)}</span>
      </div>

      <div style={{ padding: '14px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: '12px', color: '#888' }}>You receive</span>
        <span style={{ fontSize: '28px', fontWeight: 900, color: '#E8FF4D', letterSpacing: '-0.04em' }}>{fmt(payout)}</span>
      </div>

      <p style={{ marginTop: '20px', fontSize: '11px', color: '#333', lineHeight: 1.6 }}>
        No listing fee. No subscription. If it doesn&apos;t sell, you pay nothing.
      </p>
    </div>
  );
}
