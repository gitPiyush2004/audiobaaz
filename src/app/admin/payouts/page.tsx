import { createAdminClient } from '@/lib/supabase/admin';
import { formatPrice, formatDate } from '@/lib/utils/formatting';
import { PayoutTrigger } from './PayoutTrigger';

const payoutStatusStyles: Record<string, string> = {
  pending:    'bg-warning/10 text-warning',
  processing: 'bg-blue-400/10 text-blue-400',
  paid:       'bg-success/10 text-success',
  failed:     'bg-error/10 text-error',
};

async function getPending() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('orders')
    .select(`
      id, seller_payout, payout_status, created_at,
      listings!listing_id ( product_name, brand ),
      sellers:users!seller_id ( full_name, upi_id )
    `)
    .eq('status', 'completed')
    .eq('payout_status', 'pending')
    .order('created_at', { ascending: true });
  return data ?? [];
}

async function getHistory() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('orders')
    .select(`
      id, seller_payout, payout_status, payout_reference, payout_at, created_at,
      listings!listing_id ( product_name, brand ),
      sellers:users!seller_id ( full_name, upi_id )
    `)
    .eq('status', 'completed')
    .in('payout_status', ['paid', 'processing', 'failed'])
    .order('payout_at', { ascending: false })
    .limit(50);
  return data ?? [];
}

export default async function AdminPayoutsPage() {
  const [pending, history] = await Promise.all([getPending(), getHistory()]);

  return (
    <div className="space-y-10">
      {/* Pending */}
      <div>
        <h1 className="mb-6 font-heading text-2xl font-bold text-foreground">
          Seller Payouts
          {pending.length > 0 && (
            <span className="ml-3 rounded-full bg-warning px-2.5 py-0.5 font-mono text-sm font-bold text-black">
              {pending.length}
            </span>
          )}
        </h1>

        {!pending.length ? (
          <p className="text-text-2">No pending payouts.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-2">Seller</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-2">Listing</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-2">UPI</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-2">Amount</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-2">Completed</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-bg">
                {pending.map((o) => {
                  const seller  = (Array.isArray(o.sellers)  ? o.sellers[0]  : o.sellers)  as any;
                  const listing = (Array.isArray(o.listings) ? o.listings[0] : o.listings) as any;
                  return (
                    <tr key={o.id} className="transition-colors hover:bg-surface">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{seller?.full_name ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-text-2">
                        {listing?.product_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-foreground">
                        {seller?.upi_id ?? <span className="text-error">Not set</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-accent">
                        {formatPrice(o.seller_payout)}
                      </td>
                      <td className="px-4 py-3 text-right text-text-2">
                        {formatDate(o.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PayoutTrigger orderId={o.id} upiId={seller?.upi_id ?? null} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* History */}
      <div>
        <h2 className="mb-4 font-heading text-xl font-bold text-foreground">History</h2>

        {!history.length ? (
          <p className="text-text-2">No payout history yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-2">Seller</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-2">Listing</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-2">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-2">Reference</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-2">Paid at</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-bg">
                {history.map((o) => {
                  const seller  = (Array.isArray(o.sellers)  ? o.sellers[0]  : o.sellers)  as any;
                  const listing = (Array.isArray(o.listings) ? o.listings[0] : o.listings) as any;
                  return (
                    <tr key={o.id} className="transition-colors hover:bg-surface">
                      <td className="px-4 py-3 font-medium text-foreground">{seller?.full_name ?? '—'}</td>
                      <td className="px-4 py-3 text-text-2">{listing?.product_name ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-foreground">{formatPrice(o.seller_payout)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-text-2">{o.payout_reference ?? '—'}</td>
                      <td className="px-4 py-3 text-text-2">{o.payout_at ? formatDate(o.payout_at) : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={['rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize', payoutStatusStyles[o.payout_status] ?? ''].join(' ')}>
                          {o.payout_status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
