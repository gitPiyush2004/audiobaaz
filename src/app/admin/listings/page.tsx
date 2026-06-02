export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatPrice, formatDate } from '@/lib/utils/formatting';

const GRADE_STYLE: Record<string, { background: string; color: string }> = {
  S: { background: '#DBEAFE', color: '#1D4ED8' },
  A: { background: '#DCFCE7', color: '#15803D' },
  B: { background: '#FEF9C3', color: '#A16207' },
  C: { background: '#F3F4F6', color: '#374151' },
  D: { background: '#FEE2E2', color: '#B91C1C' },
};

export default async function AdminListingsPage() {
  const supabase = createAdminClient();
  const { data: listings } = await supabase
    .from('listings')
    .select(`id, product_name, brand, category, condition_grade, asking_price, photos, status, created_at, users!seller_id ( full_name, city )`)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  return (
    <>
      <div style={{ padding: '32px 40px 24px', borderBottom: '1px solid #E8E8E4', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#999', marginBottom: '6px' }}>Admin panel</div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}>Review queue</h1>
        </div>
        {!!listings?.length && (
          <span style={{ background: '#0a0a0a', color: '#E8FF4D', fontSize: '13px', fontWeight: 700, padding: '4px 12px' }}>{listings.length}</span>
        )}
      </div>

      {!listings?.length ? (
        <div style={{ padding: '56px 40px', textAlign: 'center' }}>
          <div style={{ fontSize: '13px', color: '#999' }}>No listings pending review.</div>
        </div>
      ) : (
        <div>
          {listings.map(l => {
            const sellerRaw = Array.isArray(l.users) ? l.users[0] : l.users;
            const seller = sellerRaw as { full_name: string | null; city: string | null } | null;
            const grade = GRADE_STYLE[l.condition_grade] ?? GRADE_STYLE.D;
            return (
              <Link key={l.id} href={`/admin/listings/${l.id}`}
                style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 40px', borderBottom: '1px solid #E8E8E4', textDecoration: 'none', color: 'inherit' }}
                className="hover:bg-[#FAFAF8] transition-colors"
              >
                <div style={{ width: '56px', height: '56px', flexShrink: 0, overflow: 'hidden', background: '#F5F5F2' }}>
                  {l.photos?.[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.photos[0]} alt="" style={{ width: '56px', height: '56px', objectFit: 'cover' }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.product_name}</div>
                  <div style={{ fontSize: '10px', color: '#666' }}>{l.brand} · {l.category.replace('_', '+')}{seller?.city ? ` · ${seller.city}` : ''}</div>
                  <div style={{ fontSize: '10px', color: '#999', marginTop: '1px' }}>{seller?.full_name ?? 'Unknown'} · Submitted {formatDate(l.created_at)}</div>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '14px', fontWeight: 800 }}>{formatPrice(l.asking_price)}</span>
                  <span style={{ ...grade, fontSize: '9px', fontWeight: 700, padding: '2px 8px' }}>{l.condition_grade}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
