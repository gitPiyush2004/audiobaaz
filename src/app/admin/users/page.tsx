import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils/formatting';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const supabase = createClient();
  const q = searchParams.q?.trim() ?? '';

  let query = supabase
    .from('users')
    .select('id, full_name, email, phone, city, role, seller_score, buyer_score, is_active, strike_count, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (q) {
    query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
  }

  const { data: users } = await query;

  return (
    <div>
      <h1 className="mb-6 font-heading text-2xl font-bold text-foreground">Users</h1>

      <form method="GET" className="mb-5">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name, email or phone…"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-text-2 focus:border-accent focus:outline-none"
        />
      </form>

      {!users?.length ? (
        <p className="text-text-2">No users found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-2">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-2">Role</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-2">Seller</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-2">Buyer</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-2">Strikes</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-2">Joined</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-bg">
              {users.map((u) => (
                <tr key={u.id} className="transition-colors hover:bg-surface">
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${u.id}`} className="hover:underline">
                      <p className="font-medium text-foreground">{u.full_name ?? '—'}</p>
                      <p className="text-xs text-text-2">{u.email ?? u.phone}</p>
                      {u.city && <p className="text-xs text-text-2">{u.city}</p>}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={[
                      'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                      u.role === 'admin' ? 'bg-accent/10 text-accent' : 'bg-surface text-text-2',
                    ].join(' ')}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-foreground">{u.seller_score}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-foreground">{u.buyer_score}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={u.strike_count > 0 ? 'font-mono font-bold text-error' : 'font-mono text-text-2'}>
                      {u.strike_count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-2">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3">
                    <span className={[
                      'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                      u.is_active ? 'bg-success/10 text-success' : 'bg-error/10 text-error',
                    ].join(' ')}>
                      {u.is_active ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
