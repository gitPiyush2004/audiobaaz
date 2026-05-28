import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AccountForm } from './AccountForm';

export const metadata = { title: 'Account — Audiobaaz' };

export default async function AccountPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [profileRes, ratingRes] = await Promise.all([
    supabase
      .from('users')
      .select('full_name, email, phone, city, pincode, upi_id, availability, telegram_chat_id')
      .eq('id', user.id)
      .single(),
    supabase
      .from('seller_ratings')
      .select('total_ratings, average_rating, five_star, four_star, three_star, low_star')
      .eq('seller_id', user.id)
      .maybeSingle(),
  ]);

  const profile = profileRes.data;
  const rating  = ratingRes.data;

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">Account & Trust</h1>

      {/* seller rating */}
      {rating && (
        <div className="mt-6 rounded-xl border border-border bg-surface p-5">
          <p className="mb-3 text-sm font-semibold text-foreground">Seller rating</p>
          <div className="flex items-center gap-4">
            <p className="font-heading text-4xl font-black text-accent">{rating.average_rating}</p>
            <div>
              <p className="text-sm text-foreground">{rating.total_ratings} ratings</p>
              <p className="text-xs text-muted-foreground">
                5★ {rating.five_star} · 4★ {rating.four_star} · 3★ {rating.three_star} · ≤2★ {rating.low_star}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* profile form */}
      <div className="mt-6 rounded-xl border border-border bg-surface p-5">
        <p className="mb-5 text-sm font-semibold text-foreground">Profile</p>
        <AccountForm profile={profile} email={user.email ?? ''} />
      </div>
    </div>
  );
}
