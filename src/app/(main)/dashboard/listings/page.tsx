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
  { key: 'rejected', label: 'Rejected',        statuses: ['rejected'] },
  { key: 'draft',    label: 'Drafts',          statuses: ['draft'] },
  { key: 'sold',     label: 'Sold',            statuses: ['sold', 'completed'] },
  { key: 'delisted', label: 'Delisted',        statuses: ['delisted'] },
];

const gradeColor: Record<string, string> = {
  S: 'text-grade-s', A: 'text-grade-a', B: 'text-grade-b',
  C: 'text-grade-c', D: 'text-grade-d',
};

interface Props {
  searchParams: { tab?: string };
}

export default async function ListingsPage({ searchParams }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const activeKey = TABS.find(t => t.key === searchParams.tab)?.key ?? 'live';
  const activeTab = TABS.find(t => t.key === activeKey)!;

  const { data: listings } = await supabase
    .from('listings')
    .select('id, brand, product_name, condition_grade, asking_price, status, photos, created_at, slug, rejection_reason')
    .eq('seller_id', user.id)
    .in('status', activeTab.statuses)
    .order('created_at', { ascending: false });

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">My Listings</h1>

      {/* tab bar */}
      <div className="mt-6 flex gap-0 border-b border-border">
        {TABS.map(tab => (
          <Link
            key={tab.key}
            href={`/dashboard/listings?tab=${tab.key}`}
            className={[
              '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              activeKey === tab.key
                ? 'border-accent text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="mt-6">
        {!listings?.length ? (
          <div className="rounded-xl border border-dashed border-border py-12 text-center">
            <p className="text-sm text-muted-foreground">No {activeTab.label.toLowerCase()} listings.</p>
            {activeKey === 'live' || activeKey === 'pending' ? (
              <Link
                href="/sell/new"
                className="mt-3 inline-flex h-9 items-center rounded-lg bg-accent px-5 text-sm font-semibold text-black transition-all hover:bg-accent-hover"
              >
                Create a listing
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {listings.map(l => (
              <div key={l.id} className={[
                'rounded-xl border bg-surface',
                activeKey === 'rejected' ? 'border-error/30' : 'border-border',
              ].join(' ')}>
              {activeKey === 'rejected' && l.rejection_reason && (
                <div className="flex items-start gap-2 rounded-t-xl border-b border-error/20 bg-error/5 px-4 py-3">
                  <span className="mt-px text-xs font-semibold text-error shrink-0">Reason</span>
                  <p className="text-xs text-error/80">{l.rejection_reason}</p>
                </div>
              )}
              <div className="flex items-center gap-4 p-4">
                {/* thumbnail */}
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2">
                  {l.photos?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.photos[0]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-dim-foreground">
                      No photo
                    </div>
                  )}
                </div>

                {/* info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {l.brand} {l.product_name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Grade <span className={gradeColor[l.condition_grade]}>{l.condition_grade}</span>
                    {' · '}{formatDate(l.created_at)}
                  </p>
                </div>

                {/* price + actions */}
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {activeKey === 'live' ? (
                    <PriceEdit listingId={l.id} currentPricePaise={l.asking_price} />
                  ) : (
                    <span className="font-mono text-sm font-semibold text-foreground">
                      {formatPrice(l.asking_price)}
                    </span>
                  )}
                  <div className="flex gap-2">
                    {activeKey === 'live' && l.slug && (
                      <Link
                        href={`/listing/${l.slug}`}
                        className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-border-2 hover:text-foreground"
                      >
                        View
                      </Link>
                    )}
                    {activeKey === 'live'     && <DelistButton    listingId={l.id} />}
                    {activeKey === 'pending'  && <PullBackButton  listingId={l.id} />}
                    {activeKey === 'rejected' && <ResubmitButton  listingId={l.id} />}
                    {activeKey === 'draft'    && (
                      <Link
                        href={`/sell/draft/${l.id}`}
                        className="rounded-md border border-accent/40 bg-accent/5 px-3 py-1 text-xs text-accent transition-colors hover:bg-accent/10"
                      >
                        Resume
                      </Link>
                    )}
                  </div>
                </div>
              </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
