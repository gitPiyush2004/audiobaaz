import Link from 'next/link';
import Image from 'next/image';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatPrice, formatDate } from '@/lib/utils/formatting';

const conditionColors: Record<string, string> = {
  S: 'text-accent',
  A: 'text-success',
  B: 'text-blue-400',
  C: 'text-warning',
  D: 'text-error',
};

export default async function AdminListingsPage() {
  const supabase = createAdminClient();

  const { data: listings } = await supabase
    .from('listings')
    .select(`
      id, product_name, brand, category, condition_grade,
      asking_price, photos, status, created_at,
      users!seller_id ( full_name, city )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  return (
    <div>
      <h1 className="mb-6 font-heading text-2xl font-bold text-foreground">
        Review Queue
        {listings?.length ? (
          <span className="ml-3 rounded-full bg-accent px-2.5 py-0.5 font-mono text-sm font-bold text-black">
            {listings.length}
          </span>
        ) : null}
      </h1>

      {!listings?.length ? (
        <p className="text-text-2">No listings pending review.</p>
      ) : (
        <ul className="space-y-3">
          {listings.map((l) => {
            const sellerRaw = Array.isArray(l.users) ? l.users[0] : l.users;
            const seller = sellerRaw as { full_name: string | null; city: string | null } | null;
            return (
              <li key={l.id}>
                <Link
                  href={`/admin/listings/${l.id}`}
                  className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-surface-2"
                >
                  {l.photos?.[0] && (
                    <Image
                      src={l.photos[0]}
                      alt={l.product_name}
                      width={64}
                      height={64}
                      className="h-16 w-16 shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{l.product_name}</p>
                    <p className="text-sm text-text-2">
                      {l.brand} · {l.category.replace('_', '+')}
                      {seller?.city ? ` · ${seller.city}` : ''}
                    </p>
                    <p className="text-xs text-text-2">
                      {seller?.full_name ?? 'Unknown seller'} · Submitted {formatDate(l.created_at)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono font-bold text-accent">{formatPrice(l.asking_price)}</p>
                    <p className={['text-sm font-bold', conditionColors[l.condition_grade]].join(' ')}>
                      {l.condition_grade}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
