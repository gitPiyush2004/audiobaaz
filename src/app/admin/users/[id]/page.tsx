import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils/formatting';
import { UserActions } from './UserActions';

export default async function AdminUserDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: user } = await supabase
    .from('users')
    .select('id, full_name, email, phone, city, pincode, upi_id, telegram_chat_id, role, seller_score, buyer_score, is_active, strike_count, availability, created_at, updated_at')
    .eq('id', params.id)
    .single();

  if (!user) notFound();

  // Listing counts
  const [{ count: totalListings }, { count: activeListings }, { count: totalOrders }] = await Promise.all([
    supabase.from('listings').select('id', { count: 'exact', head: true }).eq('seller_id', params.id),
    supabase.from('listings').select('id', { count: 'exact', head: true }).eq('seller_id', params.id).eq('status', 'approved'),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('buyer_id', params.id),
  ]);

  const scoreColor = (s: number) => s >= 80 ? 'text-success' : s >= 50 ? 'text-warning' : 'text-error';

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/users" className="text-sm text-text-2 hover:text-foreground">
          ← Back to users
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Left: user info */}
        <div className="space-y-6">
          {/* Header */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="font-heading text-xl font-bold text-foreground">{user.full_name ?? 'No name'}</h1>
                <p className="text-sm text-text-2">{user.email ?? '—'}</p>
                <p className="text-sm text-text-2">{user.phone}</p>
                {user.city && <p className="text-sm text-text-2">{user.city}{user.pincode ? ` — ${user.pincode}` : ''}</p>}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={[
                  'rounded-full px-3 py-1 text-xs font-semibold',
                  user.is_active ? 'bg-success/10 text-success' : 'bg-error/10 text-error',
                ].join(' ')}>
                  {user.is_active ? 'Active' : 'Suspended'}
                </span>
                <span className={[
                  'rounded-full px-3 py-1 text-xs font-semibold',
                  user.role === 'admin' ? 'bg-accent/10 text-accent' : 'bg-surface-2 text-text-2',
                ].join(' ')}>
                  {user.role}
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-text-2">Seller score</p>
                <p className={['font-mono text-2xl font-bold', scoreColor(user.seller_score)].join(' ')}>{user.seller_score}</p>
              </div>
              <div>
                <p className="text-xs text-text-2">Buyer score</p>
                <p className={['font-mono text-2xl font-bold', scoreColor(user.buyer_score)].join(' ')}>{user.buyer_score}</p>
              </div>
              <div>
                <p className="text-xs text-text-2">Strikes</p>
                <p className={['font-mono text-2xl font-bold', user.strike_count > 0 ? 'text-error' : 'text-foreground'].join(' ')}>
                  {user.strike_count}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-2">Availability</p>
                <p className="text-sm capitalize text-foreground">{user.availability}</p>
              </div>
            </div>
          </div>

          {/* Activity stats */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-3 font-heading text-lg font-semibold text-foreground">Activity</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-text-2">Total listings</p>
                <p className="font-mono text-xl font-bold text-foreground">{totalListings ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-text-2">Live listings</p>
                <p className="font-mono text-xl font-bold text-foreground">{activeListings ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-text-2">Orders placed</p>
                <p className="font-mono text-xl font-bold text-foreground">{totalOrders ?? 0}</p>
              </div>
            </div>
          </div>

          {/* Account details */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-3 font-heading text-lg font-semibold text-foreground">Account</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-2">UPI ID</dt>
                <dd className="font-mono text-foreground">{user.upi_id ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-2">Telegram chat ID</dt>
                <dd className="font-mono text-foreground">{user.telegram_chat_id ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-2">Member since</dt>
                <dd className="text-foreground">{formatDate(user.created_at)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-2">Last updated</dt>
                <dd className="text-foreground">{formatDate(user.updated_at)}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Right: actions */}
        <UserActions
          userId={user.id}
          isActive={user.is_active}
          isAdmin={user.role === 'admin'}
          strikeCount={user.strike_count}
        />
      </div>
    </div>
  );
}
