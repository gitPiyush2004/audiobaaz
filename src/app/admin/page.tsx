import { createAdminClient } from '@/lib/supabase/admin';
import Link from 'next/link';

async function getStats() {
  const supabase = createAdminClient();
  const [listings, disputes, payouts, users] = await Promise.all([
    supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('disputes').select('id', { count: 'exact', head: true }).in('status', ['open', 'under_review']),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'completed').eq('payout_status', 'pending'),
    supabase.from('users').select('id', { count: 'exact', head: true }),
  ]);
  return {
    pendingListings: listings.count ?? 0,
    openDisputes:    disputes.count ?? 0,
    pendingPayouts:  payouts.count ?? 0,
    totalUsers:      users.count ?? 0,
  };
}

export default async function AdminOverviewPage() {
  const stats = await getStats();

  const cards = [
    { label: 'Pending listings', value: stats.pendingListings, href: '/admin/listings', urgent: stats.pendingListings > 0 },
    { label: 'Open disputes',    value: stats.openDisputes,    href: '/admin/disputes', urgent: stats.openDisputes > 0 },
    { label: 'Pending payouts',  value: stats.pendingPayouts,  href: '/admin/payouts',  urgent: stats.pendingPayouts > 0 },
    { label: 'Total users',      value: stats.totalUsers,      href: '/admin/users',    urgent: false },
  ];

  return (
    <>
      <div style={{ padding: '32px 40px 24px', borderBottom: '1px solid #E8E8E4' }}>
        <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#999', marginBottom: '6px' }}>Admin panel</div>
        <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}>
          Overview
        </h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid #E8E8E4' }}>
        {cards.map(({ label, value, href, urgent }, i, arr) => (
          <Link
            key={label}
            href={href}
            style={{
              display: 'block', padding: '24px 28px',
              borderRight: i < arr.length - 1 ? '1px solid #E8E8E4' : 'none',
              textDecoration: 'none', color: 'inherit',
            }}
            className="hover:bg-[#FAFAF8] transition-colors"
          >
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#999', marginBottom: '12px' }}>{label}</div>
            <div style={{ fontSize: '36px', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, color: urgent ? '#E8FF4D' : '#0a0a0a', background: urgent ? '#0a0a0a' : 'transparent', display: 'inline-block', padding: urgent ? '0 4px' : '0' }}>
              {value}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
