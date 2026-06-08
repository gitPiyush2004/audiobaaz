import { createClient } from '@/lib/supabase/server';
import { formatPrice, formatDate } from '@/lib/utils/formatting';
import { pickOne } from '@/lib/utils/relations';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Dashboard — Audiobaaz' };

// ── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const h = ist.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function dashDate(): string {
  const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return `${DAYS[ist.getDay()]}, ${ist.getDate()} ${MONTHS[ist.getMonth()]} ${ist.getFullYear()}`;
}

function fmtActivityTime(iso: string): string {
  const d   = new Date(iso);
  const now = new Date();
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const isToday = d.toDateString() === now.toDateString();
  const h = d.getHours(), m = d.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 || 12;
  const min  = m.toString().padStart(2, '0');
  const time = `${hour}:${min}${ampm}`;
  if (isToday) return `Today · ${time}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} · ${time}`;
}

const GRADE_STYLE: Record<string, { background: string; color: string }> = {
  S: { background: '#DBEAFE', color: '#1D4ED8' },
  A: { background: '#DCFCE7', color: '#15803D' },
  B: { background: '#FEF9C3', color: '#A16207' },
  C: { background: '#F3F4F6', color: '#374151' },
  D: { background: '#FEE2E2', color: '#B91C1C' },
};

const STATUS_LABEL: Record<string, string> = {
  approved: 'Live', pending: 'Pending', draft: 'Draft',
  rejected: 'Rejected', reserved: 'Reserved',
  sold: 'Sold', completed: 'Sold', delisted: 'Delisted',
};

const STATUS_STYLE: Record<string, { background: string; color: string }> = {
  approved:  { background: '#DCFCE7', color: '#15803D' },
  pending:   { background: '#FEF9C3', color: '#A16207' },
  draft:     { background: '#F3F4F6', color: '#374151' },
  rejected:  { background: '#DBEAFE', color: '#1D4ED8' },
  reserved:  { background: '#FEF9C3', color: '#A16207' },
  sold:      { background: '#F3F4F6', color: '#374151' },
  completed: { background: '#F3F4F6', color: '#374151' },
  delisted:  { background: '#F3F4F6', color: '#9CA3AF' },
};

// ── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  searchParams: { submitted?: string };
}

export default async function DashboardPage({ searchParams }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [profileRes, allListingsRes, pendingOffersRes, completedOrdersRes, recentListingsRes, ratingsRes] =
    await Promise.all([
      supabase.from('users').select('full_name').eq('id', user.id).single(),
      supabase.from('listings').select('id, status').eq('seller_id', user.id),
      supabase.from('offers').select('id').eq('seller_id', user.id).eq('status', 'pending'),
      supabase
        .from('orders')
        .select('id, seller_payout, completed_at, listings!listing_id(brand, product_name)')
        .eq('seller_id', user.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(5),
      supabase
        .from('listings')
        .select('id, slug, brand, product_name, condition_grade, asking_price, status, created_at, photos')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase.from('ratings').select('id').eq('ratee_id', user.id).limit(1),
    ]);

  const profile         = profileRes.data;
  const allListings     = allListingsRes.data  ?? [];
  const pendingOffers   = pendingOffersRes.data ?? [];
  const completedOrders = completedOrdersRes.data ?? [];
  const recentListings  = recentListingsRes.data  ?? [];

  // ── Stat derivations ──
  const liveCount     = allListings.filter(l => l.status === 'approved').length;
  const pendingCount  = allListings.filter(l => l.status === 'pending').length;
  const offerCount    = pendingOffers.length;
  const soldCount     = completedOrders.length;
  const totalEarnings = completedOrders.reduce((s, o) => s + (o.seller_payout ?? 0), 0);

  const lastSoldOrder   = completedOrders[0] ?? null;
  const lastSoldListing = lastSoldOrder
    ? pickOne<{ brand: string; product_name: string }>(lastSoldOrder.listings)
    : null;
  const lastSoldName = lastSoldListing
    ? `${lastSoldListing.brand} ${lastSoldListing.product_name}`
    : null;

  // ── Checklist ──
  const hasListing = allListings.length > 0;
  const hasReview  = (ratingsRes.data?.length ?? 0) > 0;

  const firstName = (profile?.full_name ?? 'Seller').split(' ')[0];

  // ── Activity items ──
  type ActivityItem = { dot: 'green' | 'blue' | 'amber'; textParts: (string | { bold: string })[]; time: string };
  const activity: ActivityItem[] = [];

  completedOrders.slice(0, 3).forEach(o => {
    const l = pickOne<{ brand: string; product_name: string }>(o.listings);
    if (l && o.completed_at) {
      activity.push({
        dot: 'green',
        textParts: [
          { bold: `${l.brand} ${l.product_name}` },
          ` sold for ${formatPrice(o.seller_payout ?? 0)}. Payment released to payout account.`,
        ],
        time: fmtActivityTime(o.completed_at),
      });
    }
  });

  if (offerCount > 0) {
    activity.push({
      dot: 'blue',
      textParts: [
        { bold: `${offerCount} new offer${offerCount !== 1 ? 's' : ''}` },
        ' received on your listings. Respond within 24 hours.',
      ],
      time: 'Today',
    });
  }

  const DOT_COLOR = { green: '#22c55e', blue: '#3b82f6', amber: '#f59e0b' };

  return (
    <>
      {/* ── Submission toast ── */}
      {searchParams.submitted === '1' && (
        <div style={{ margin: '0', padding: '14px 40px', background: '#DCFCE7', borderBottom: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#15803D', flexShrink: 0 }} />
          <div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#15803D' }}>Listing submitted for review</span>
            <span style={{ fontSize: '12px', color: '#15803D', marginLeft: '8px' }}>We typically review within 2–4 hours. You&apos;ll get a Telegram message when it goes live.</span>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ padding: '32px 40px 24px', borderBottom: '1px solid #E8E8E4', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#999', marginBottom: '6px' }}>
            Seller dashboard
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}>
            {getGreeting()},{' '}
            <em style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400 }}>{firstName}.</em>
          </h1>
        </div>
        <div style={{ fontSize: '11px', fontWeight: 500, color: '#999', letterSpacing: '0.04em' }}>
          {dashDate()}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid #E8E8E4' }}>
        {/* Live listings */}
        <StatCard
          eyebrow="Live listings"
          number={liveCount.toString()}
          sub={liveCount > 0 ? `${liveCount} active listing${liveCount !== 1 ? 's' : ''}` : 'No active listings'}
          trend={liveCount > 0 ? { label: `↑ ${liveCount} live now`, green: true } : { label: '— Getting started', green: false }}
        />
        {/* Pending review */}
        <StatCard
          eyebrow="Pending review"
          number={pendingCount.toString()}
          sub={pendingCount > 0 ? 'Awaiting admin grade' : 'Nothing awaiting grade'}
          trend={pendingCount > 0 ? { label: '↑ Review in 2–4hr', green: true } : { label: '— All clear', green: false }}
        />
        {/* Active offers */}
        <StatCard
          eyebrow="Active offers"
          number={offerCount.toString()}
          sub={offerCount > 0 ? 'Awaiting your response' : 'No pending offers'}
          trend={offerCount > 0 ? { label: '↑ Respond within 24hr', green: true } : { label: '— All clear', green: false }}
        />
        {/* Total earned — accent card */}
        <div style={{ padding: '24px 28px', background: '#0a0a0a', position: 'relative', overflow: 'hidden' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#555', marginBottom: '12px' }}>Total earned</div>
          <div style={{ fontSize: '36px', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, color: '#E8FF4D', marginBottom: '6px' }}>
            {totalEarnings > 0 ? formatPrice(totalEarnings) : '₹0'}
          </div>
          <div style={{ fontSize: '10px', fontWeight: 500, color: '#444', letterSpacing: '0.04em' }}>
            {soldCount} item{soldCount !== 1 ? 's' : ''} sold · all time
          </div>
          <div style={{ fontSize: '10px', fontWeight: 600, color: '#555', marginTop: '4px' }}>
            {lastSoldName ? `→ ${lastSoldName}` : '→ No sales yet'}
          </div>
        </div>
      </div>

      {/* ── Content grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', borderBottom: '1px solid #E8E8E4' }}>

        {/* Recent listings panel */}
        <div style={{ borderRight: '1px solid #E8E8E4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px 16px', borderBottom: '1px solid #E8E8E4' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em' }}>Recent listings</div>
            <Link href="/dashboard/listings" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#0a0a0a', textDecoration: 'none', borderBottom: '1px solid #0a0a0a', paddingBottom: '1px' }}>
              View all
            </Link>
          </div>

          {recentListings.length === 0 ? (
            <div style={{ padding: '48px 28px', textAlign: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>No listings yet</div>
              <div style={{ fontSize: '12px', color: '#999', lineHeight: 1.5, marginBottom: '16px' }}>
                List your first piece of gear — condition-graded and escrow-protected.
              </div>
              <Link href="/sell/new" style={{ background: '#E8FF4D', color: '#0a0a0a', padding: '10px 20px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none', display: 'inline-block' }}>
                List your gear
              </Link>
            </div>
          ) : (
            <>
              {recentListings.map(l => {
                const grade  = GRADE_STYLE[l.condition_grade] ?? GRADE_STYLE.D;
                const status = STATUS_STYLE[l.status] ?? STATUS_STYLE.draft;
                const href = l.status === 'draft'
                  ? '/dashboard/listings?tab=draft'
                  : `/listing/${l.slug ?? l.id}`;
                const photos = l.photos as string[] | null;
                const cover  = photos?.[0] ?? null;
                return (
                  <Link
                    key={l.id}
                    href={href}
                    style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 28px', borderBottom: '1px solid #E8E8E4', textDecoration: 'none', color: 'inherit' }}
                    className="hover:bg-[#FAFAF8] transition-colors"
                  >
                    <div style={{ width: '44px', height: '44px', background: '#F5F5F2', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cover} alt="" style={{ width: '44px', height: '44px', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <svg width="28" height="28" viewBox="0 0 48 48" fill="none" style={{ opacity: 0.15 }}>
                          <rect x="8" y="18" width="32" height="12" rx="2" stroke="#888" strokeWidth="1.5" fill="none"/>
                          <circle cx="16" cy="24" r="2.5" stroke="#888" strokeWidth="1.2" fill="none"/>
                          <circle cx="24" cy="24" r="2.5" stroke="#888" strokeWidth="1.2" fill="none"/>
                        </svg>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', textTransform: 'uppercase', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.brand} {l.product_name}
                      </div>
                      <div style={{ fontSize: '10px', color: '#999', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Listed {formatDate(l.created_at)} ·
                        <span style={{ ...grade, fontSize: '9px', fontWeight: 700, padding: '1px 5px' }}>{l.condition_grade}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                      <span style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '-0.02em' }}>
                        {formatPrice(l.asking_price)}
                      </span>
                      <span style={{ ...status, fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 8px' }}>
                        {STATUS_LABEL[l.status] ?? l.status}
                      </span>
                    </div>
                  </Link>
                );
              })}

              {recentListings.length < 5 && (
                <div style={{ padding: '32px 28px', textAlign: 'center' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>No other listings yet</div>
                  <div style={{ fontSize: '12px', color: '#999', lineHeight: 1.5 }}>
                    List your next piece of gear — every listing is condition-graded and escrow-protected.
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right panel — checklist + tips */}
        <div>
          {/* Getting started checklist */}
          <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E8E8E4' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#999', marginBottom: '4px' }}>Setup</div>
            <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em' }}>Getting started</div>
          </div>

          <CheckItem done label="Create your account" sub="Done — you're in." />
          <CheckItem
            done={hasListing}
            label="Post your first listing"
            sub={hasListing
              ? `${recentListings[recentListings.length - 1]?.brand ?? ''} ${recentListings[recentListings.length - 1]?.product_name ?? ''} — listed.`.trim()
              : 'Submit your first piece of gear to get started.'}
          />
          <CheckItem
            done={hasReview}
            label="Get your first review"
            sub={hasReview ? 'Reviews are live on your profile.' : 'Buyers trust verified sellers. Complete a transaction to unlock.'}
          />

          {/* Seller tips */}
          <div style={{ borderTop: '1px solid #E8E8E4' }}>
            <div style={{ padding: '16px 24px 12px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#999', marginBottom: '4px' }}>Seller tips</div>
              <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em' }}>How to sell faster</div>
            </div>
            {[
              { n: '01', text: 'Photos on a white surface with natural light always outperform dark or cluttered backgrounds.' },
              { n: '02', text: 'Mention every accessory — original box, cables, tips. Completeness adds perceived value.' },
              { n: '03', text: 'Price 10–15% below market to sell in under a week. Overpriced gear sits for months.' },
            ].map(tip => (
              <div key={tip.n} style={{ padding: '10px 24px', borderTop: '1px solid #E8E8E4', display: 'flex', gap: '10px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#999', flexShrink: 0, width: '16px' }}>{tip.n}</div>
                <div style={{ fontSize: '11px', color: '#666', lineHeight: 1.5 }}>{tip.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent activity ── */}
      <div style={{ borderBottom: '1px solid #E8E8E4' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px 16px', borderBottom: '1px solid #E8E8E4' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em' }}>Recent activity</div>
          <Link href="/dashboard/activity" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#0a0a0a', textDecoration: 'none', borderBottom: '1px solid #0a0a0a', paddingBottom: '1px' }}>
            All activity
          </Link>
        </div>

        {activity.length === 0 ? (
          <div style={{ padding: '32px 28px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#999' }}>No recent activity.</div>
          </div>
        ) : (
          activity.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 28px', borderBottom: i < activity.length - 1 ? '1px solid #E8E8E4' : 'none' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: DOT_COLOR[item.dot], flexShrink: 0 }} />
              <div style={{ fontSize: '12px', color: '#666', flex: 1, lineHeight: 1.4 }}>
                {item.textParts.map((part, j) =>
                  typeof part === 'string'
                    ? <span key={j}>{part}</span>
                    : <strong key={j} style={{ color: '#0a0a0a', fontWeight: 600 }}>{part.bold}</strong>
                )}
              </div>
              <div style={{ fontSize: '10px', color: '#999', whiteSpace: 'nowrap' }}>{item.time}</div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ eyebrow, number, sub, trend }: {
  eyebrow: string;
  number: string;
  sub: string;
  trend: { label: string; green: boolean };
}) {
  return (
    <div style={{ padding: '24px 28px', borderRight: '1px solid #E8E8E4', position: 'relative', overflow: 'hidden' }}>
      <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#999', marginBottom: '12px' }}>
        {eyebrow}
      </div>
      <div style={{ fontSize: '36px', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, color: '#0a0a0a', marginBottom: '6px' }}>
        {number}
      </div>
      <div style={{ fontSize: '10px', fontWeight: 500, color: '#999', letterSpacing: '0.04em' }}>{sub}</div>
      <div style={{ fontSize: '10px', fontWeight: 600, color: trend.green ? '#15803D' : '#999', marginTop: '4px' }}>
        {trend.label}
      </div>
    </div>
  );
}

function CheckItem({ done, label, sub }: { done: boolean; label: string; sub: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 24px', borderBottom: '1px solid #E8E8E4' }}>
      <div style={{
        width: '18px', height: '18px', border: '1.5px solid',
        borderColor: done ? '#0a0a0a' : '#E8E8E4',
        background: done ? '#0a0a0a' : 'transparent',
        flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', marginTop: '1px',
      }}>
        {done && <span style={{ fontSize: '10px', color: '#E8FF4D', fontWeight: 700, lineHeight: 1 }}>✓</span>}
      </div>
      <div>
        <div style={{ fontSize: '12px', fontWeight: 500, color: done ? '#999' : '#0a0a0a', lineHeight: 1.4, textDecoration: done ? 'line-through' : 'none', textDecorationColor: '#ccc' }}>
          {label}
        </div>
        <div style={{ fontSize: '10px', color: '#999', marginTop: '2px', lineHeight: 1.4 }}>{sub}</div>
      </div>
    </div>
  );
}
