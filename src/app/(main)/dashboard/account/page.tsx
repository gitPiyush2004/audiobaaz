export const dynamic = 'force-dynamic';

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

  function StarBar({ count, total }: { count: number; total: number }) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
      <div style={{ height: '4px', background: '#E8E8E4', flex: 1 }}>
        <div style={{ height: '4px', background: '#0a0a0a', width: `${pct}%` }} />
      </div>
    );
  }

  return (
    <>
      {/* ── Page header ── */}
      <div style={{ padding: '32px 40px 24px', borderBottom: '1px solid #E8E8E4' }}>
        <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#999', marginBottom: '6px' }}>
          Seller dashboard
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}>
          Account &amp;{' '}
          <em style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400 }}>trust</em>
        </h1>
      </div>

      {/* ── Seller rating ── */}
      {rating && (
        <div style={{ borderBottom: '1px solid #E8E8E4' }}>
          <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid #E8E8E4' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#999', marginBottom: '4px' }}>Reputation</div>
            <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em' }}>Seller rating</div>
          </div>
          <div style={{ padding: '20px 28px', display: 'flex', gap: '32px', alignItems: 'center' }}>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: '40px', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, color: '#0a0a0a' }}>{rating.average_rating}</div>
              <div style={{ fontSize: '10px', color: '#999', marginTop: '4px' }}>{rating.total_ratings} ratings</div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { label: '5★', count: rating.five_star  },
                { label: '4★', count: rating.four_star  },
                { label: '3★', count: rating.three_star },
                { label: '≤2★', count: rating.low_star  },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '10px', color: '#999', width: '24px', flexShrink: 0 }}>{row.label}</span>
                  <StarBar count={row.count} total={rating.total_ratings} />
                  <span style={{ fontSize: '10px', color: '#666', width: '20px', textAlign: 'right', flexShrink: 0 }}>{row.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Profile form ── */}
      <div style={{ borderBottom: '1px solid #E8E8E4' }}>
        <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid #E8E8E4' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#999', marginBottom: '4px' }}>Identity</div>
          <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em' }}>Profile</div>
        </div>
        <div style={{ padding: '24px 28px' }}>
          <AccountForm profile={profile} email={user.email ?? ''} />
        </div>
      </div>
    </>
  );
}
