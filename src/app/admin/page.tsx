import { createClient } from '@/lib/supabase/server';

async function getStats() {
  const supabase = createClient();
  const [listings, disputes, payouts, users] = await Promise.all([
    supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('disputes').select('id', { count: 'exact', head: true }).in('status', ['open', 'under_review']),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'completed').eq('payout_status', 'pending'),
    supabase.from('users').select('id', { count: 'exact', head: true }),
  ]);
  return {
    pendingListings: listings.count ?? 0,
    openDisputes: disputes.count ?? 0,
    pendingPayouts: payouts.count ?? 0,
    totalUsers: users.count ?? 0,
  };
}

export default async function AdminOverviewPage() {
  const stats = await getStats();

  const cards = [
    { label: 'Pending Listings', value: stats.pendingListings, href: '/admin/listings', urgent: stats.pendingListings > 0 },
    { label: 'Open Disputes',    value: stats.openDisputes,    href: '/admin/disputes', urgent: stats.openDisputes > 0 },
    { label: 'Pending Payouts',  value: stats.pendingPayouts,  href: '/admin/payouts',  urgent: stats.pendingPayouts > 0 },
    { label: 'Total Users',      value: stats.totalUsers,      href: '/admin/users',    urgent: false },
  ];

  return (
    <div>
      <h1 className="mb-6 font-heading text-2xl font-bold text-foreground">Overview</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map(({ label, value, href, urgent }) => (
          <a
            key={label}
            href={href}
            className="rounded-xl border border-border bg-surface p-5 transition-colors hover:bg-surface-2"
          >
            <p className="text-sm text-text-2">{label}</p>
            <p className={['mt-1 font-mono text-3xl font-bold', urgent ? 'text-accent' : 'text-foreground'].join(' ')}>
              {value}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}
