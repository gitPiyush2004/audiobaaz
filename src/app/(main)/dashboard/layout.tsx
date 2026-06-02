import { createClient } from '@/lib/supabase/server';
import { DashboardNav } from '@/components/layout/DashboardNav';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [profileRes, offersRes] = await Promise.all([
    supabase.from('users').select('full_name, created_at').eq('id', user.id).single(),
    supabase.from('offers').select('id').eq('seller_id', user.id).eq('status', 'pending'),
  ]);

  const fullName   = profileRes.data?.full_name ?? 'Seller';
  const memberYear = profileRes.data?.created_at
    ? new Date(profileRes.data.created_at).getFullYear()
    : new Date().getFullYear();
  const offerCount = offersRes.data?.length ?? 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: 'calc(100vh - 60px)' }}>
      <DashboardNav fullName={fullName} memberYear={memberYear} offerCount={offerCount} />
      <main style={{ minWidth: 0, overflow: 'hidden' }}>{children}</main>
    </div>
  );
}
