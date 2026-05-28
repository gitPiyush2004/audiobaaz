import { createClient } from '@/lib/supabase/server';
import { formatPrice, formatDate } from '@/lib/utils/formatting';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Dashboard — Audiobaaz' };

interface Props {
  searchParams: { submitted?: string };
}

const gradeColor: Record<string, string> = {
  S: 'text-grade-s', A: 'text-grade-a', B: 'text-grade-b',
  C: 'text-grade-c', D: 'text-grade-d',
};

const statusColor: Record<string, string> = {
  approved:  'text-success',
  pending:   'text-warning',
  draft:     'text-muted-foreground',
  rejected:  'text-error',
  completed: 'text-info',
  reserved:  'text-accent',
  delisted:  'text-dim-foreground',
};

export default async function DashboardPage({ searchParams }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [listingsRes, offersRes, earningsRes] = await Promise.all([
    supabase.from('listings').select('status').eq('seller_id', user.id),
    supabase.from('offers').select('id').eq('seller_id', user.id).eq('status', 'pending'),
    supabase.from('orders').select('seller_payout').eq('seller_id', user.id).eq('status', 'completed'),
  ]);

  const listings  = listingsRes.data  ?? [];
  const offers    = offersRes.data    ?? [];
  const completed = earningsRes.data  ?? [];

  const totalEarnings = completed.reduce((s, o) => s + (o.seller_payout ?? 0), 0);

  const stats = [
    { label: 'Live listings',  value: listings.filter(l => l.status === 'approved').length.toString() },
    { label: 'Pending review', value: listings.filter(l => l.status === 'pending').length.toString() },
    { label: 'Active offers',  value: offers.length.toString() },
    { label: 'Total earned',   value: totalEarnings > 0 ? formatPrice(totalEarnings) : '—' },
  ];

  const { data: recent } = await supabase
    .from('listings')
    .select('id, brand, product_name, condition_grade, asking_price, status, created_at')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);

  return (
    <div>
      {searchParams.submitted === '1' && (
        <div className="mb-8 flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 px-5 py-4">
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-success" />
          <div>
            <p className="text-sm font-semibold text-success">Listing submitted for review</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              We typically review within 2–4 hours between 9 am and 9 pm IST.
              You&apos;ll get a Telegram message when it goes live.
            </p>
          </div>
        </div>
      )}

      <h1 className="font-heading text-2xl font-bold text-foreground">Overview</h1>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 font-heading text-2xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold text-foreground">Recent listings</h2>
          <Link href="/dashboard/listings" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            View all
          </Link>
        </div>

        {!recent?.length ? (
          <div className="rounded-xl border border-dashed border-border py-12 text-center">
            <p className="text-sm text-muted-foreground">No listings yet.</p>
            <Link
              href="/sell/new"
              className="mt-3 inline-flex h-9 items-center rounded-lg bg-accent px-5 text-sm font-semibold text-black transition-all hover:bg-accent-hover"
            >
              Create your first listing
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {recent.map(l => (
              <div key={l.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {l.brand} {l.product_name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Grade <span className={gradeColor[l.condition_grade]}>{l.condition_grade}</span>
                    {' · '}{formatDate(l.created_at)}
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
        )}
      </div>
    </div>
  );
}
