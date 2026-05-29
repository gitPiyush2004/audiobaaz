'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatPrice } from '@/lib/utils/formatting';

const inputCls = [
  'w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground',
  'placeholder:text-dim-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors',
].join(' ');

const labelCls = 'mb-1.5 block text-sm font-medium text-foreground';

interface Props {
  listingId:    string;
  productName:  string;
  askingPrice:  number;
  defaultName:  string;
  defaultPhone: string;
  defaultCity:  string;
}

export function CheckoutForm({
  listingId, productName, askingPrice,
  defaultName, defaultPhone, defaultCity,
}: Props) {
  const [name,    setName]    = useState(defaultName);
  const [phone,   setPhone]   = useState(defaultPhone.replace(/^\+91/, ''));
  const [line1,   setLine1]   = useState('');
  const [line2,   setLine2]   = useState('');
  const [city,    setCity]    = useState(defaultCity);
  const [pincode, setPincode] = useState('');
  const [state,   setState]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const router = useRouter();

  const platformFee  = Math.floor(askingPrice * 0.10);
  const sellerPayout = askingPrice - platformFee;

  const phoneDigits = phone.replace(/\D/g, '');
  const canSubmit   = name.trim() && phoneDigits.length === 10 &&
    line1.trim() && city.trim() && pincode.trim().length >= 5 && state.trim();

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);

    const res  = await fetch('/api/checkout/mock', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listing_id:       listingId,
        delivery_name:    name.trim(),
        delivery_phone:   `+91${phoneDigits}`,
        delivery_line1:   line1.trim(),
        delivery_line2:   line2.trim() || undefined,
        delivery_city:    city.trim(),
        delivery_pincode: pincode.trim(),
        delivery_state:   state.trim(),
      }),
    });

    const json = await res.json();
    if (json.error) {
      setError(json.error.message);
      setLoading(false);
      return;
    }

    router.push(`/orders/purchase/${json.data.order_id}`);
  }

  return (
    <form onSubmit={handleConfirm} className="space-y-6">

      {/* Price summary */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Order summary
        </h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground truncate pr-4">{productName}</span>
            <span className="font-mono font-medium text-foreground shrink-0">{formatPrice(askingPrice)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Platform fee (10%)</span>
            <span className="font-mono">{formatPrice(platformFee)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Shipping</span>
            <span className="font-mono">TBD</span>
          </div>
          <div className="border-t border-border pt-2 flex justify-between font-semibold">
            <span className="text-foreground">You pay</span>
            <span className="font-mono text-accent">{formatPrice(askingPrice)}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Seller receives {formatPrice(sellerPayout)} after our 10% fee.
          Funds are held in escrow until you confirm delivery.
        </p>
      </div>

      {/* Delivery details */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Delivery details
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Full name</label>
            <input type="text" required value={name} onChange={e => setName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <div className="flex">
              <span className="inline-flex items-center rounded-l-lg border border-r-0 border-border bg-surface-2 px-3 text-sm text-muted-foreground select-none">+91</span>
              <input
                type="tel" required maxLength={10}
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className={[inputCls, 'rounded-l-none'].join(' ')}
              />
            </div>
          </div>
        </div>

        <div>
          <label className={labelCls}>Address line 1</label>
          <input type="text" required placeholder="Flat / House no., Street" value={line1} onChange={e => setLine1(e.target.value)} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Address line 2 <span className="font-normal text-muted-foreground">(optional)</span></label>
          <input type="text" placeholder="Landmark, Area" value={line2} onChange={e => setLine2(e.target.value)} className={inputCls} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>City</label>
            <input type="text" required value={city} onChange={e => setCity(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Pincode</label>
            <input type="text" required maxLength={6} value={pincode} onChange={e => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>State</label>
            <input type="text" required placeholder="Maharashtra" value={state} onChange={e => setState(e.target.value)} className={inputCls} />
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">{error}</p>
      )}

      <button
        type="submit"
        disabled={!canSubmit || loading}
        className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-accent text-sm font-semibold text-black transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? 'Placing order…' : `Confirm purchase · ${formatPrice(askingPrice)}`}
      </button>

    </form>
  );
}
