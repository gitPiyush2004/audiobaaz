'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
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

// Razorpay's checkout.js exposes a global constructor.
// We declare the minimum surface area we use; a fuller type
// definition lives at https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/
interface RazorpayInstance {
  open: () => void;
  on:   (event: string, handler: (response: unknown) => void) => void;
}

interface RazorpayOptions {
  key:         string;
  amount:      number;
  currency:    string;
  name:        string;
  description: string;
  order_id:    string;
  prefill?:    { name?: string; email?: string; contact?: string };
  theme?:      { color?: string };
  modal?:      { ondismiss?: () => void };
  handler:     (response: RazorpaySuccessResponse) => void;
}

interface RazorpaySuccessResponse {
  razorpay_order_id:   string;
  razorpay_payment_id: string;
  razorpay_signature:  string;
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
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

    // ── Step 1: create the Razorpay order via our backend.
    // /api/payments/create acquires the checkout lock, calls
    // Razorpay's orders.create, inserts payment_pending order +
    // created payment rows, returns the modal params.
    let createJson;
    try {
      const res = await fetch('/api/payments/create', {
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
      createJson = await res.json();
    } catch {
      setError('Network error. Please check your connection and try again.');
      setLoading(false);
      return;
    }

    if (createJson.error) {
      setError(createJson.error.message);
      setLoading(false);
      return;
    }

    const { razorpay_order_id, razorpay_key_id, amount, currency, order_id, synthetic } = createJson.data;

    // ── Synthetic (dev) path ─────────────────────────────────────
    // When the active PaymentProvider is the dev provider,
    // /api/payments/create returns synthetic:true and a null key.
    // Bypass the Razorpay modal entirely and submit a synthesised
    // payment to /api/dev/payments/simulate, which signs a payload
    // the verify route accepts. Same lifecycle, no external network.
    if (synthetic) {
      try {
        const simRes = await fetch('/api/dev/payments/simulate', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ razorpay_order_id }),
        });
        const simJson = await simRes.json();
        if (simJson.error) {
          setError(simJson.error.message);
          setLoading(false);
          return;
        }
        await runVerify({
          razorpay_order_id:   simJson.data.razorpay_order_id,
          razorpay_payment_id: simJson.data.razorpay_payment_id,
          razorpay_signature:  simJson.data.razorpay_signature,
          method:              'dev',
        });
      } catch {
        setError('Dev simulation failed. Check the server logs.');
        setLoading(false);
      }
      return;
    }

    // ── Razorpay path ────────────────────────────────────────────
    // Step 2: ensure Razorpay's checkout.js loaded.
    if (typeof window === 'undefined' || !window.Razorpay) {
      setError('Payment gateway is still loading. Please try again in a moment.');
      setLoading(false);
      return;
    }

    if (!razorpay_key_id) {
      setError('Payment gateway is not configured. Please try again later.');
      setLoading(false);
      return;
    }

    // ── Step 3: open the modal.
    const rzp = new window.Razorpay({
      key:         razorpay_key_id,
      amount,
      currency,
      name:        'Audiobaaz',
      description: productName,
      order_id:    razorpay_order_id,
      prefill: {
        name:    name.trim(),
        contact: phoneDigits,
      },
      theme: {
        color: '#E8FF4D',
      },
      modal: {
        ondismiss() {
          // Buyer closed the modal without completing payment.
          // Their order row stays in 'payment_pending'; checkout_lock
          // expires after its TTL. They can retry by re-submitting
          // the form. Surface a soft message rather than an error.
          setLoading(false);
          setError('Payment was cancelled. You can try again or come back later.');
        },
      },
      async handler(response) {
        await runVerify({
          razorpay_order_id:   response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature:  response.razorpay_signature,
          method:              'card', // Razorpay reports method via webhook; default for client path
        });
      },
    });

    rzp.open();

    async function runVerify(payload: {
      razorpay_order_id:   string;
      razorpay_payment_id: string;
      razorpay_signature:  string;
      method:              string;
    }) {
      try {
        const verifyRes = await fetch('/api/payments/verify', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const verifyJson = await verifyRes.json();

        if (verifyJson.error) {
          setError(verifyJson.error.message);
          setLoading(false);
          return;
        }

        // Three possible RPC outcomes:
        //   - winner   → buyer owns the listing; go to order detail
        //   - conflict → another buyer captured first; refund initiated
        //   - noop     → idempotent replay (webhook already processed)
        if (verifyJson.data?.result === 'conflict') {
          setError(
            'Another buyer completed payment for this listing first. ' +
            'Your refund is on the way (typically 5–10 business days).',
          );
          setLoading(false);
          return;
        }

        // 'winner' or 'noop' both end with the buyer's order in escrow_held;
        // route to the order detail page.
        router.push(`/orders/purchase/${order_id}`);
      } catch {
        setError(
          'Payment captured but verification failed. Our team has been notified ' +
          'and will reach out within 24 hours.',
        );
        setLoading(false);
      }
    }
  }

  return (
    <>
      {/* Razorpay checkout.js loaded lazily — only needed on this page. */}
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

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
          {loading ? 'Opening Razorpay…' : `Pay · ${formatPrice(askingPrice)}`}
        </button>

      </form>
    </>
  );
}
