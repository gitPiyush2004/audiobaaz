import { createClient } from '@/lib/supabase/server';
import { formatPrice } from '@/lib/utils/formatting';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Dashboard — Audiobaaz' };

interface Props {
  searchParams: { submitted?: string };
}

export default async function DashboardPage({ searchParams }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [listingsRes, offersRes, earningsRes] = await Promise.all([
    supabase
      .from('listings')
      .select('status')
      .eq('seller_id', user.id),
    supabase
      .from('offers')
      .select('id')
      .eq('seller_id', user.id)
      .eq('status', 'pending'),
    supabase
      .from('orders')
      .select('seller_payout')
      .eq('seller_id', user.id)
      .eq('status', 'completed'),
  ]);

  const listings  = listingsRes.data  ?? [];
  const offers    = offersRes.data    ?? [];
  const completed = earningsRes.data  ?? [];

  const counts = {
    live:    listings.filter(l => l.status === 'approved').length,
    pending: listings.filter(l => l.status === 'pending').length,
    draft:   listings.filter(l => l.status === 'draft').length,
    sold:    listings.filter(l => l.status === 'completed').length,
  };

  const totalEarnings = completed.reduce((sum, o) => sum + (o.seller_payout ?? 0), 0);

  const stats = [
    { label: 'Live listings',    value: counts.live.toString() },
    { label: 'Pending review',   value: counts.pending.toString() },
    { label: 'Active offers',    value: offers.length.toString() },
    { label: 'Total earned',     value: totalEarnings > 0 ? formatPrice(totalEarnings) : '—' },
  ];

  const navLinks = [
    { href: '/dashboard',          label: 'Overview' },
    { href: '/dashboard/listings', label: 'My Listings' },
    { href: '/dashboard/offers',   label: 'Offers' },
    { href: '/dashboard/orders',   label: 'Orders' },
    { href: '/dashboard/payouts',  label: 'Payouts' },
    { href: '/dashboard/account',  label: 'Account' },
  ];

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">

        {/* submitted banner */}
        {searchParams.submitted === '1' && (
          <div className="mb-8 flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 px-5 py-4">
            <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-success" />
            <div>
              <p className="text-sm font-semibold text-success">Listing submitted for review</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                We typically review listings within 2–4 hours between 9 am and 9 pm IST.
                You&apos;ll get a Telegram message when it goes live.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-8 sm:flex-row">

          {/* sidebar nav */}
          <nav className="shrink-0 sm:w-44">
            <ul className="space-y-1">
              {navLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="block rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t border-border pt-6">
              <Link
                href="/sell/new"
                className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-accent text-sm font-semibold text-black transition-all hover:bg-accent-hover"
              >
                + New listing
              </Link>
            </div>
          </nav>

          {/* main content */}
          <div className="flex-1">
            <h1 className="font-heading text-2xl font-bold text-foreground">Overview</h1>

            {/* stat cards */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stats.map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-border bg-surface p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-2 font-heading text-2xl font-bold text-foreground">{value}</p>
                </div>
              ))}
            </div>

            {/* recent listings */}
            <div className="mt-8">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-heading text-base font-semibold text-foreground">Recent listings</h2>
                <Link href="/dashboard/listings" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  View all
                </Link>
              </div>

              {counts.live + counts.pending + counts.draft === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-12 text-center">
                  <p className="text-sm text-muted-foreground">No listings yet.</p>
                  <Link
                    href="/sell/new"
                    className="mt-3 inline-flex h-9 items-center rounded-lg bg-accent px-5 text-sm font-semibold text-black hover:bg-accent-hover transition-all"
                  >
                    Create your first listing
                  </Link>
                </div>
              ) : (
                <RecentListings userId={user.id} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

async function RecentListings({ userId }: { userId: string }) {
  const supabase = createClient();
  const { data: listings } = await supabase
    .from('listings')
    .select('id, product_name, brand, condition_grade, asking_price, status, created_at')
    .eq('seller_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!listings?.length) return null;

  const statusColor: Record<string, string> = {
    approved: 'text-success',
    pending:  'text-warning',
    draft:    'text-muted-foreground',
    rejected: 'text-error',
    sold:     'text-info',
    completed:'text-info',
    reserved: 'text-accent',
    delisted: 'text-dim-foreground',
  };

  const gradeColor: Record<string, string> = {
    S: 'text-grade-s', A: 'text-grade-a', B: 'text-grade-b',
    C: 'text-grade-c', D: 'text-grade-d',
  };

  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-surface overflow-hidden">
      {listings.map(l => (
        <div key={l.id} className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {l.brand} {l.product_name}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Grade{' '}
              <span className={gradeColor[l.condition_grade] ?? 'text-foreground'}>
                {l.condition_grade}
              </span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <span className="font-mono text-sm text-foreground">{formatPrice(l.asking_price)}</span>
            <span className={`text-xs font-medium capitalize ${statusColor[l.status] ?? 'text-muted-foreground'}`}>
              {l.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
