export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { formatPrice, formatDate } from '@/lib/utils/formatting';
import { pickOne } from '@/lib/utils/relations';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const metadata = { title: 'Orders — Audiobaaz' };

const ORDER_STATUS: Record<string, { label: string; background: string; color: string }> = {
  payment_pending: { label: 'Awaiting payment', background: '#FEF9C3', color: '#A16207' },
  escrow_held:     { label: 'Payment received',  background: '#DBEAFE', color: '#1D4ED8' },
  shipped:         { label: 'Shipped',            background: '#DBEAFE', color: '#1D4ED8' },
  delivered:       { label: 'Delivered',          background: '#DBEAFE', color: '#1D4ED8' },
  inspection:      { label: 'Buyer inspection',  background: '#FEF9C3', color: '#A16207' },
  completed:       { label: 'Completed',          background: '#DCFCE7', color: '#15803D' },
  disputed:        { label: 'Disputed',           background: '#FEE2E2', color: '#B91C1C' },
  refunded:        { label: 'Refunded',           background: '#F3F4F6', color: '#374151' },
};

const ACTIVE_STATUSES = ['payment_pending', 'escrow_held', 'shipped', 'delivered', 'inspection', 'disputed'];

export default async function OrdersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: orders } = await supabase
    .from('orders')
    .select('id, status, paid_price, seller_payout, created_at, shipped_at, tracking_number, courier_name, listings!listing_id(product_name, brand)')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false });

  const active    = (orders ?? []).filter(o => ACTIVE_STATUSES.includes(o.status));
  const completed = (orders ?? []).filter(o => !ACTIVE_STATUSES.includes(o.status));

  function OrderRow({ order }: { order: NonNullable<typeof orders>[number] }) {
    const listing = pickOne<{ brand: string; product_name: string }>(order.listings);
    const s = ORDER_STATUS[order.status] ?? { label: order.status, background: '#F3F4F6', color: '#374151' };
    return (
      <Link
        href={`/dashboard/orders/${order.id}`}
        style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 28px', borderBottom: '1px solid #E8E8E4', textDecoration: 'none', color: 'inherit' }}
        className="hover:bg-[#FAFAF8] transition-colors"
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', textTransform: 'uppercase', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {listing?.brand} {listing?.product_name}
          </div>
          <div style={{ fontSize: '10px', color: '#999', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{formatDate(order.created_at)}</span>
            {order.tracking_number && (
              <span style={{ color: '#666' }}>{order.courier_name} · {order.tracking_number}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '-0.02em' }}>{formatPrice(order.seller_payout)}</div>
            <div style={{ fontSize: '9px', color: '#999', marginTop: '1px' }}>your payout</div>
          </div>
          <span style={{ ...s, fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 8px' }}>
            {s.label}
          </span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ opacity: 0.3, flexShrink: 0 }}>
            <path d="M5 2l5 5-5 5" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </Link>
    );
  }

  return (
    <>
      {/* ── Page header ── */}
      <div style={{ padding: '32px 40px 24px', borderBottom: '1px solid #E8E8E4' }}>
        <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#999', marginBottom: '6px' }}>
          Seller dashboard
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}>
          My{' '}
          <em style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400 }}>orders</em>
        </h1>
      </div>

      {/* ── Quick stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderBottom: '1px solid #E8E8E4' }}>
        {[
          { n: (orders?.length ?? 0).toString(),    l: 'Total orders' },
          { n: active.length.toString(),            l: 'Active' },
          { n: completed.length.toString(),         l: 'Completed' },
        ].map((s, i, arr) => (
          <div key={s.l} style={{ padding: '16px 28px', borderRight: i < arr.length - 1 ? '1px solid #E8E8E4' : 'none' }}>
            <div style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: '3px' }}>{s.n}</div>
            <div style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#999' }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* ── Active orders ── */}
      <div style={{ borderBottom: '1px solid #E8E8E4' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px 16px', borderBottom: '1px solid #E8E8E4' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em' }}>Active orders</div>
          <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 8px', background: active.length > 0 ? '#0a0a0a' : '#E8E8E4', color: active.length > 0 ? '#fff' : '#666' }}>
            {active.length}
          </span>
        </div>
        {active.length === 0 ? (
          <div style={{ padding: '40px 28px', textAlign: 'center' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>No active orders</div>
            <div style={{ fontSize: '12px', color: '#999', lineHeight: 1.5 }}>Orders appear here after a buyer pays for an accepted offer.</div>
          </div>
        ) : (
          active.map(o => <OrderRow key={o.id} order={o} />)
        )}
      </div>

      {/* ── Completed orders ── */}
      {completed.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px 16px', borderBottom: '1px solid #E8E8E4' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em' }}>Completed orders</div>
            <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 8px', background: '#E8E8E4', color: '#666' }}>{completed.length}</span>
          </div>
          {completed.map(o => <OrderRow key={o.id} order={o} />)}
        </div>
      )}
    </>
  );
}
