import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatDate } from '@/lib/utils/formatting';

const reasonLabels: Record<string, string> = {
  condition_mismatch:  'Condition mismatch',
  non_functional:      'Non-functional',
  missing_accessory:   'Missing accessory',
  not_received:        'Not received',
  wrong_item:          'Wrong item',
};

const statusStyles: Record<string, string> = {
  open:         'bg-error/10 text-error',
  under_review: 'bg-warning/10 text-warning',
};

export default async function AdminDisputesPage() {
  const supabase = createAdminClient();

  const { data: disputes } = await supabase
    .from('disputes')
    .select(`
      id, reason, status, created_at,
      orders!order_id ( id, listing_price, paid_price ),
      users!buyer_id  ( full_name )
    `)
    .in('status', ['open', 'under_review'])
    .order('created_at', { ascending: true });

  return (
    <div>
      <h1 className="mb-6 font-heading text-2xl font-bold text-foreground">
        Disputes
        {disputes?.length ? (
          <span className="ml-3 rounded-full bg-error px-2.5 py-0.5 font-mono text-sm font-bold text-white">
            {disputes.length}
          </span>
        ) : null}
      </h1>

      {!disputes?.length ? (
        <p className="text-text-2">No open disputes.</p>
      ) : (
        <ul className="space-y-3">
          {disputes.map((d) => {
            const buyer = (Array.isArray(d.users) ? d.users[0] : d.users) as { full_name: string | null } | null;
            return (
              <li key={d.id}>
                <Link
                  href={`/admin/disputes/${d.id}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-surface-2"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{reasonLabels[d.reason] ?? d.reason}</p>
                    <p className="text-sm text-text-2">
                      {buyer?.full_name ?? 'Unknown buyer'} · {formatDate(d.created_at)}
                    </p>
                  </div>
                  <span className={['shrink-0 rounded-full px-3 py-1 text-xs font-semibold capitalize', statusStyles[d.status] ?? ''].join(' ')}>
                    {d.status.replace('_', ' ')}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
