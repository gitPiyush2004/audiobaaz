import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils/formatting';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Activity — Audiobaaz' };

export default async function ActivityPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, type, message, sent_via, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">Activity</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        All notifications sent to you via Telegram.
      </p>

      <div className="mt-8">
        {!notifications?.length ? (
          <div className="rounded-xl border border-dashed border-border py-12 text-center">
            <p className="text-sm text-muted-foreground">No activity yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Notifications will appear here once your listing goes live and buyers engage.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {notifications.map(n => (
              <div key={n.id} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{n.message}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(n.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
