export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { formatPrice, formatDate } from '@/lib/utils/formatting';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DelistButton } from './DelistButton';
import { PullBackButton } from './PullBackButton';
import { ResubmitButton } from './ResubmitButton';
import { PriceEdit } from './PriceEdit';

export const metadata = { title: 'My Listings — Audiobaaz' };

const TABS = [
  { key: 'live',     label: 'Live',           statuses: ['approved'] },
  { key: 'pending',  label: 'Pending Review',  statuses: ['pending'] },
  { key: 'draft',    label: 'Drafts',          statuses: ['draft'] },
  { key: 'sold',     label: 'Sold',            statuses: ['sold', 'completed'] },
  { key: 'rejected', label: 'Rejected',        statuses: ['rejected'] },
  { key: 'delisted', label: 'Delisted',        statuses: ['delisted'] },
];

const EMPTY: Record<string, { title: string; sub: string }> = {
  live:     { title: 'No live listings',        sub: 'Your listing goes live after our team verifies the condition. It usually takes under 24 hours.' },
  pending:  { title: 'Nothing in review',       sub: 'Submit a listing and our team will grade and publish it within 24 hours.' },
  draft:    { title: 'No drafts',               sub: 'Start a listing and save it as a draft to come back later.' },
  sold:     { title: 'Nothing sold yet',        sub: 'Once a buyer purchases one of your listings, it will appear here.' },
  rejected: { title: 'No rejected listings',   sub: 'All good — no listings have been rejected.' },
  delisted: { title: 'No delisted listings',   sub: 'Listings you remove from the marketplace appear here.' },
};

const GRADE_STYLE: Record<string, { background: string; color: string }> = {
  S: { background: '#DBEAFE', color: '#1D4ED8' },
  A: { background: '#DCFCE7', color: '#15803D' },
  B: { background: '#FEF9C3', color: '#A16207' },
  C: { background: '#F3F4F6', color: '#374151' },
  D: { background: '#FEE2E2', color: '#B91C1C' },
};

const STATUS_STYLE: Record<string, { background: string; color: string }> = {
  approved:  { background: '#DCFCE7', color: '#15803D' },
  pending:   { background: '#FEF9C3', color: '#A16207' },
  draft:     { background: '#F3F4F6', color: '#374151' },
  rejected:  { background: '#DBEAFE', color: '#1D4ED8' },
  reserved:  { background: '#FEF9C3', color: '#A16207' },
  sold:      { background: '#F3F4F6', color: '#374151' },
  completed: { background: '#F3F4F6', color: '#374151' },
  delisted:  { background: '#F5F5F5', color: '#9CA3AF' },
};

const STATUS_LABEL: Record<string, string> = {
  approved: 'Live', pending: 'Pending', draft: 'Draft', rejected: 'Review',
  reserved: 'Reserved', sold: 'Sold', completed: 'Sold', delisted: 'Delisted',
};

interface Props { searchParams: { tab?: string } }

export default async function ListingsPage({ searchParams }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [allListingsRes, ordersRes] = await Promise.all([
    supabase
      .from('listings')
      .select('id, brand, product_name, condition_grade, asking_price, status, photos, created_at, slug, rejection_reason')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('orders')
      .select('seller_payout')
      .eq('seller_id', user.id)
      .eq('status', 'completed'),
  ]);

  const allListings = allListingsRes.data ?? [];
  const totalEarnings = (ordersRes.data ?? []).reduce((s, o) => s + (o.seller_payout ?? 0), 0);

  const tabCounts: Record<string, number> = {};
  for (const tab of TABS) {
    tabCounts[tab.key] = allListings.filter(l => tab.statuses.includes(l.status)).length;
  }

  const activeKey = TABS.find(t => t.key === searchParams.tab)?.key ?? 'live';
  const activeTab = TABS.find(t => t.key === activeKey)!;
  const displayListings = allListings.filter(l => activeTab.statuses.includes(l.status));

  const soldCount    = tabCounts.sold ?? 0;
  const totalListed  = allListings.length;
  const sellThrough  = totalListed > 0 ? Math.round((soldCount / totalListed) * 100) : 0;

  const empty = EMPTY[activeKey];

  return (
    <>
      {/* ── Page header ── */}
      <div style={{ padding: '32px 40px 0', borderBottom: '1px solid #E8E8E4' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#999', marginBottom: '6px' }}>
              Seller dashboard
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}>
              My{' '}
              <em style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400 }}>listings</em>
            </h1>
          </div>
          <Link href="/sell/new" style={{ background: '#E8FF4D', color: '#0a0a0a', padding: '11px 24px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
            + New listing
          </Link>
        </div>

        {/* Tab strip */}
        <div style={{ display: 'flex' }}>
          {TABS.map(tab => {
            const isActive = activeKey === tab.key;
            const isSold   = tab.key === 'sold';
            const activeColor = isSold ? '#15803D' : '#0a0a0a';
            return (
              <Link
                key={tab.key}
                href={`/dashboard/listings?tab=${tab.key}`}
                style={{
                  fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: isActive ? activeColor : '#999',
                  padding: '12px 20px',
                  borderBottom: `2px solid ${isActive ? activeColor : 'transparent'}`,
                  display: 'flex', alignItems: 'center', gap: '6px',
                  whiteSpace: 'nowrap', textDecoration: 'none',
                }}
              >
                {tab.label}
                <span style={{
                  fontSize: '9px', fontWeight: 700, padding: '1px 5px',
                  background: isActive ? (isSold ? '#DCFCE7' : '#0a0a0a') : '#E8E8E4',
                  color: isActive ? (isSold ? '#15803D' : '#fff') : '#666',
                }}>
                  {tabCounts[tab.key] ?? 0}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Quick stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid #E8E8E4' }}>
        {[
          { n: totalListed.toString(),                           l: 'Total listed' },
          { n: soldCount.toString(),                             l: 'Items sold' },
          { n: totalEarnings > 0 ? formatPrice(totalEarnings) : '₹0', l: 'Total earned' },
          { n: `${sellThrough}%`,                                l: 'Sell-through rate' },
        ].map((s, i, arr) => (
          <div key={s.l} style={{ padding: '16px 28px', borderRight: i < arr.length - 1 ? '1px solid #E8E8E4' : 'none' }}>
            <div style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: '3px' }}>{s.n}</div>
            <div style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#999' }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* ── Content area ── */}
      {displayListings.length === 0 ? (
        <>
          <div style={{ padding: '56px 40px 48px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px', borderBottom: '1px solid #E8E8E4' }}>
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ opacity: 0.1, marginBottom: '4px' }}>
              <rect x="8" y="20" width="48" height="32" stroke="#0a0a0a" strokeWidth="2.5"/>
              <line x1="8" y1="30" x2="56" y2="30" stroke="#0a0a0a" strokeWidth="2"/>
              <circle cx="20" cy="25" r="2" fill="#0a0a0a"/>
              <rect x="16" y="38" width="12" height="8" stroke="#0a0a0a" strokeWidth="1.8" fill="none"/>
              <line x1="34" y1="40" x2="48" y2="40" stroke="#0a0a0a" strokeWidth="1.8"/>
              <line x1="34" y1="44" x2="44" y2="44" stroke="#0a0a0a" strokeWidth="1.8"/>
            </svg>
            <div style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.03em' }}>{empty.title}</div>
            <div style={{ fontSize: '13px', color: '#999', maxWidth: '300px', lineHeight: 1.6 }}>{empty.sub}</div>
            {(activeKey === 'live' || activeKey === 'pending' || activeKey === 'draft') && (
              <Link href="/sell/new" style={{ background: '#E8FF4D', color: '#0a0a0a', padding: '12px 28px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none', marginTop: '4px' }}>
                + Create a listing
              </Link>
            )}
          </div>

          {/* How to list — shown on live tab when empty */}
          {activeKey === 'live' && (
            <div style={{ padding: '0 40px 32px', borderBottom: '1px solid #E8E8E4' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#999', paddingTop: '24px', marginBottom: '6px' }}>How to list</div>
              <div style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '16px' }}>Four steps to a successful sale</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: '#E8E8E4', border: '1px solid #E8E8E4' }}>
                {[
                  { n: '01', title: 'Write your listing', desc: 'Describe condition honestly, list every accessory, and note any cosmetic defects. Buyers trust transparent sellers.', tag: 'HONEST DESCRIPTION' },
                  { n: '02', title: 'Add photos', desc: '4+ clear photos in good lighting. Include the unit, box, cables, and any defects. Minimum 1200×900px.', tag: '1200×900 MIN' },
                  { n: '03', title: 'Set your price', desc: 'Research sold prices on Head-Fi and local classifieds. Price to sell — overpriced gear sits for months.', tag: '10–15% BELOW MARKET' },
                  { n: '04', title: 'Submit for review', desc: 'Our team verifies condition and publishes within 24hrs. You\'ll get a Telegram notification when it goes live.', tag: '24HR REVIEW' },
                ].map(step => (
                  <div key={step.n} style={{ background: '#fff', padding: '20px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#999', marginBottom: '10px' }}>{step.n}</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '5px' }}>{step.title}</div>
                    <div style={{ fontSize: '11px', color: '#666', lineHeight: 1.5 }}>{step.desc}</div>
                    <span style={{ display: 'inline-block', marginTop: '10px', fontSize: '9px', fontWeight: 700, padding: '2px 8px', background: '#F5F5F2', color: '#999', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      {step.tag}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div>
          {displayListings.map(l => {
            const grade  = GRADE_STYLE[l.condition_grade] ?? GRADE_STYLE.D;
            const status = STATUS_STYLE[l.status] ?? STATUS_STYLE.draft;
            const photos = l.photos as string[] | null;
            const cover  = photos?.[0] ?? null;
            return (
              <div key={l.id} style={{ borderBottom: '1px solid #E8E8E4' }}>
                {/* Rejection reason */}
                {activeKey === 'rejected' && l.rejection_reason && (
                  <div style={{ padding: '10px 28px', background: '#FEF2F2', borderBottom: '1px solid #FECACA', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B91C1C', flexShrink: 0, marginTop: '1px' }}>Reason</span>
                    <span style={{ fontSize: '12px', color: '#B91C1C' }}>{l.rejection_reason}</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 28px' }}
                  className="hover:bg-[#FAFAF8] transition-colors"
                >
                  {/* Thumbnail */}
                  <div style={{ width: '44px', height: '44px', background: '#F5F5F2', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt="" style={{ width: '44px', height: '44px', objectFit: 'cover' }} />
                    ) : (
                      <svg width="28" height="28" viewBox="0 0 48 48" fill="none" style={{ opacity: 0.15 }}>
                        <rect x="8" y="18" width="32" height="12" rx="2" stroke="#888" strokeWidth="1.5" fill="none"/>
                        <circle cx="16" cy="24" r="2.5" stroke="#888" strokeWidth="1.2" fill="none"/>
                        <circle cx="24" cy="24" r="2.5" stroke="#888" strokeWidth="1.2" fill="none"/>
                      </svg>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', textTransform: 'uppercase', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.brand} {l.product_name}
                    </div>
                    <div style={{ fontSize: '10px', color: '#999', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Listed {formatDate(l.created_at)} ·
                      <span style={{ ...grade, fontSize: '9px', fontWeight: 700, padding: '1px 5px' }}>{l.condition_grade}</span>
                    </div>
                  </div>

                  {/* Price + status + actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                    {activeKey === 'live' ? (
                      <PriceEdit listingId={l.id} currentPricePaise={l.asking_price} />
                    ) : (
                      <span style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '-0.02em' }}>
                        {formatPrice(l.asking_price)}
                      </span>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ ...status, fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 8px' }}>
                        {STATUS_LABEL[l.status] ?? l.status}
                      </span>
                      {activeKey === 'live' && l.slug && process.env.NEXT_PUBLIC_APP_URL !== 'https://audiobaaz.com' && (
                        <Link href={`/listing/${l.slug}`} style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#666', border: '1px solid #E8E8E4', padding: '3px 10px', textDecoration: 'none' }}>
                          View
                        </Link>
                      )}
                      {activeKey === 'live'     && <DelistButton listingId={l.id} />}
                      {activeKey === 'pending'  && <PullBackButton listingId={l.id} />}
                      {activeKey === 'rejected' && <ResubmitButton listingId={l.id} />}
                      {activeKey === 'draft'    && (
                        <Link href={`/sell/draft/${l.id}`} style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#0a0a0a', background: '#E8FF4D', padding: '3px 10px', textDecoration: 'none' }}>
                          Resume
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
