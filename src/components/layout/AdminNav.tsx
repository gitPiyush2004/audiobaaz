'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/admin',           label: 'Overview',  exact: true  },
  { href: '/admin/listings',  label: 'Listings',  exact: false },
  { href: '/admin/orders',    label: 'Orders',    exact: false },
  { href: '/admin/disputes',  label: 'Disputes',  exact: false },
  { href: '/admin/users',     label: 'Users',     exact: false },
  { href: '/admin/payouts',   label: 'Payouts',   exact: false },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <aside style={{
      display: 'flex', flexDirection: 'column',
      borderRight: '1px solid #E8E8E4',
      padding: '32px 0',
      position: 'sticky', top: '60px',
      height: 'calc(100vh - 60px)',
      background: '#fff',
    }}>
      <div style={{ padding: '0 24px 24px', borderBottom: '1px solid #E8E8E4', marginBottom: '8px' }}>
        <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#999' }}>
          Admin panel
        </div>
      </div>

      {NAV_ITEMS.map(item => {
        const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'block',
              padding: '10px 24px',
              fontSize: '13px',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? '#0a0a0a' : '#666',
              borderLeft: `2px solid ${isActive ? '#0a0a0a' : 'transparent'}`,
              background: isActive ? '#FAFAF8' : 'transparent',
              textDecoration: 'none',
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </aside>
  );
}
