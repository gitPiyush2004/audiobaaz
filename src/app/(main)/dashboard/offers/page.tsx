import { createClient } from '@/lib/supabase/server';
import { formatPrice, formatDate } from '@/lib/utils/formatting';
import { pickOne } from '@/lib/utils/relations';
import { redirect } from 'next/navigation';
import { OfferActions } from './OfferActions';

export const metadata = { title: 'Offers — Audiobaaz' };

function timeRemaining(deadline: string | null): string | null {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

const OFFER_STATUS: Record<string, { background: string; color: string; label: string }> = {
  pending:   { background: '#FEF9C3', color: '#A16207', label: 'Pending' },
  accepted:  { background: '#DCFCE7', color: '#15803D', label: 'Accepted' },
  declined:  { background: '#FEE2E2', color: '#B91C1C', label: 'Declined' },
  expired:   { background: '#F3F4F6', color: '#9CA3AF', label: 'Expired' },
  paid:      { background: '#DBEAFE', color: '#1D4ED8', label: 'Paid' },
  cancelled: { background: '#F3F4F6', color: '#9CA3AF', label: 'Cancelled' },
};

export default async function OffersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: offers } = await supabase
    .from('offers')
    .select('id, offered_price, status, created_at, seller_must_respond_by, listings!listing_id(product_name, brand)')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false });

  const pending = (offers ?? []).filter(o => o.status === 'pending');
  const past    = (offers ?? []).filter(o => o.status !== 'pending');

  return (
    <>
      {/* ── Page header ── */}
      <div style={{ padding: '32px 40px 24px', borderBottom: '1px solid #E8E8E4' }}>
        <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#999', marginBottom: '6px' }}>
          Seller dashboard
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}>
          My{' '}
          <em style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400 }}>offers</em>
        </h1>
      </div>

      {/* ── Pending offers ── */}
      <div style={{ borderBottom: '1px solid #E8E8E4' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px 16px', borderBottom: '1px solid #E8E8E4' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em' }}>Pending offers</div>
          <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 8px', background: pending.length > 0 ? '#0a0a0a' : '#E8E8E4', color: pending.length > 0 ? '#fff' : '#666' }}>
            {pending.length}
          </span>
        </div>

        {pending.length === 0 ? (
          <div style={{ padding: '40px 28px', textAlign: 'center' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>No pending offers</div>
            <div style={{ fontSize: '12px', color: '#999', lineHeight: 1.5 }}>
              When buyers make offers on your listings, they appear here. You have 24 hours to respond.
            </div>
          </div>
        ) : (
          pending.map((o, i) => {
            const listing   = pickOne<{ brand: string; product_name: string }>(o.listings);
            const remaining = timeRemaining(o.seller_must_respond_by);
            return (
              <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '20px 28px', borderBottom: i < pending.length - 1 ? '1px solid #E8E8E4' : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', textTransform: 'uppercase', marginBottom: '4px' }}>
                    {listing?.brand} {listing?.product_name}
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: '4px' }}>
                    {formatPrice(o.offered_price)}
                  </div>
                  {remaining && (
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#A16207' }}>{remaining} to respond</div>
                  )}
                </div>
                <OfferActions offerId={o.id} />
              </div>
            );
          })
        )}
      </div>

      {/* ── Past offers ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px 16px', borderBottom: '1px solid #E8E8E4' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em' }}>Past offers</div>
          <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 8px', background: '#E8E8E4', color: '#666' }}>
            {past.length}
          </span>
        </div>

        {past.length === 0 ? (
          <div style={{ padding: '32px 28px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#999' }}>No past offers yet.</div>
          </div>
        ) : (
          past.map((o, i) => {
            const listing = pickOne<{ brand: string; product_name: string }>(o.listings);
            const s = OFFER_STATUS[o.status] ?? { background: '#F3F4F6', color: '#374151', label: o.status };
            return (
              <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 28px', borderBottom: i < past.length - 1 ? '1px solid #E8E8E4' : 'none' }}
                className="hover:bg-[#FAFAF8] transition-colors"
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {listing?.brand} {listing?.product_name}
                  </div>
                  <div style={{ fontSize: '10px', color: '#999' }}>{formatDate(o.created_at)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                  <span style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '-0.02em' }}>{formatPrice(o.offered_price)}</span>
                  <span style={{ ...s, fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 8px' }}>{s.label}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
