import { createClient } from '@/lib/supabase/server';
import { formatPrice, formatDate } from '@/lib/utils/formatting';
import { pickOne } from '@/lib/utils/relations';
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

  const upiId  = profileRes.data?.upi_id ?? null;
  const orders = ordersRes.data ?? [];
  const total  = orders.reduce((s, o) => s + (o.seller_payout ?? 0), 0);
  const pending = orders.filter(o => o.payout_status === 'pending').length;

  return (
    <>
      {/* ── Page header ── */}
      <div style={{ padding: '32px 40px 24px', borderBottom: '1px solid #E8E8E4' }}>
        <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#999', marginBottom: '6px' }}>
          Seller dashboard
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}>
          My{' '}
          <em style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400 }}>payouts</em>
        </h1>
      </div>

      {/* ── Quick stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', borderBottom: '1px solid #E8E8E4' }}>
        {[
          { n: total > 0 ? formatPrice(total) : '₹0', l: 'Total earned' },
          { n: pending.toString(),                      l: 'Payouts pending' },
        ].map((s, i, arr) => (
          <div key={s.l} style={{ padding: '16px 28px', borderRight: i < arr.length - 1 ? '1px solid #E8E8E4' : 'none' }}>
            <div style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: '3px' }}>{s.n}</div>
            <div style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#999' }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* ── UPI ID ── */}
      <div style={{ borderBottom: '1px solid #E8E8E4' }}>
        <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid #E8E8E4' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#999', marginBottom: '4px' }}>Payout method</div>
          <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em' }}>UPI ID</div>
        </div>
        <div style={{ padding: '20px 28px' }}>
          {!upiId && (
            <div style={{ padding: '12px 16px', background: '#FEF9C3', border: '1px solid #FDE68A', marginBottom: '16px', fontSize: '12px', color: '#A16207' }}>
              Add your UPI ID to receive payouts. Required before any payout can be released.
            </div>
          )}
          <UpiForm currentUpi={upiId} />
        </div>
      </div>

      {/* ── Earnings history ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px 16px', borderBottom: '1px solid #E8E8E4' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em' }}>Earnings history</div>
          <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 8px', background: '#E8E8E4', color: '#666' }}>{orders.length}</span>
        </div>

        {orders.length === 0 ? (
          <div style={{ padding: '40px 28px', textAlign: 'center' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>No completed sales yet</div>
            <div style={{ fontSize: '12px', color: '#999', lineHeight: 1.5 }}>Earnings from completed orders will appear here.</div>
          </div>
        ) : (
          orders.map((o, i) => {
            const listing = pickOne<{ brand: string; product_name: string }>(o.listings);
            return (
              <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 28px', borderBottom: i < orders.length - 1 ? '1px solid #E8E8E4' : 'none' }}
                className="hover:bg-[#FAFAF8] transition-colors"
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {listing?.brand} {listing?.product_name}
                  </div>
                  <div style={{ fontSize: '10px', color: '#999' }}>{o.completed_at ? formatDate(o.completed_at) : '—'}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '-0.02em' }}>{formatPrice(o.seller_payout)}</div>
                    <div style={{ fontSize: '9px', color: '#999' }}>of {formatPrice(o.paid_price)} sale</div>
                  </div>
                  <span style={{
                    fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 8px',
                    background: o.payout_status === 'paid' ? '#DCFCE7' : '#FEF9C3',
                    color: o.payout_status === 'paid' ? '#15803D' : '#A16207',
                  }}>
                    {o.payout_status === 'paid' ? 'Paid out' : 'Pending'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
