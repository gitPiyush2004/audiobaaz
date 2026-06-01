import { createClient } from '@/lib/supabase/server';
import { formatPrice, formatDate } from '@/lib/utils/formatting';
import { redirect } from 'next/navigation';
import { UpiForm } from './UpiForm';

export const metadata = { title: 'Payouts — Audiobaaz' };

export default async function PayoutsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [profileRes, ordersRes] = await Promise.all([
    supabase.from('users').select('upi_id').eq('id', user.id).single(),
    supabase
      .from('orders')
      .select('id, seller_payout, paid_price, platform_fee, payout_status, completed_at, listings!listing_id(product_name, brand)')
      .eq('seller_id', user.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false }),
  ]);

  const upiId    = profileRes.data?.upi_id ?? null;
  const orders   = ordersRes.data ?? [];
  const total    = orders.reduce((s, o) => s + (o.seller_payout ?? 0), 0);
  const pending  = orders.filter(o => o.payout_status === 'pending').length;

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">Payouts</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Payouts are sent to your UPI ID after the 48-hour buyer inspection window closes.
      </p>

      {/* UPI management */}
      <div className="mt-8 rounded-xl border border-border bg-surface p-5">
        <p className="mb-4 text-sm font-semibold text-foreground">UPI ID</p>
        <UpiForm currentUpi={upiId} />
      </div>

      {/* earnings summary */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted-foreground">Total earned</p>
          <p className="mt-2 font-heading text-2xl font-bold text-foreground">
            {total > 0 ? formatPrice(total) : '—'}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted-foreground">Payouts pending</p>
          <p className="mt-2 font-heading text-2xl font-bold text-foreground">{pending}</p>
        </div>
      </div>

      {/* per-sale breakdown */}
      <div className="mt-8">
        <h2 className="mb-4 font-heading text-base font-semibold text-foreground">Earnings history</h2>

        {orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-10 text-center">
            <p className="text-sm text-muted-foreground">No completed sales yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {orders.map(o => {
              const listing = Array.isArray(o.listings) ? o.listings[0] : o.listings;
              return (
                <div key={o.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">
                        {listing?.brand} {listing?.product_name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {o.completed_at ? formatDate(o.completed_at) : '—'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-sm font-semibold text-foreground">
                        {formatPrice(o.seller_payout)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        of {formatPrice(o.paid_price)} sale
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={[
                      'text-xs font-medium',
                      o.payout_status === 'paid' ? 'text-success' : 'text-warning',
                    ].join(' ')}>
                      {o.payout_status === 'paid' ? 'Paid out' : 'Payout pending'}
                    </span>
                    <span className="text-xs text-dim-foreground">
                      · Platform fee {formatPrice(o.platform_fee)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
