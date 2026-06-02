'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Props {
  fullName: string;
  memberYear: number;
  offerCount: number;
}

const NAV_ITEMS = [
  {
    href: '/dashboard',
    label: 'Overview',
    exact: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="9" y="1" width="6" height="6" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="1" y="9" width="6" height="6" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="9" y="9" width="6" height="6" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/listings',
    label: 'My Listings',
    exact: false,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="12" height="10" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="5" y1="7" x2="11" y2="7" stroke="currentColor" strokeWidth="1.2"/>
        <line x1="5" y1="9.5" x2="9" y2="9.5" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/offers',
    label: 'Offers',
    exact: false,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 4h12l-1 8H3L2 4z" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M5 4V3a3 3 0 016 0v1" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/orders',
    label: 'Orders',
    exact: false,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/payouts',
    label: 'Payouts',
    exact: false,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="4" width="12" height="9" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M5 4V3h6v1" stroke="currentColor" strokeWidth="1.2"/>
        <line x1="8" y1="7" x2="8" y2="10" stroke="currentColor" strokeWidth="1.2"/>
        <line x1="6.5" y1="8.5" x2="9.5" y2="8.5" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/account',
    label: 'Account',
    exact: false,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M3 13c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
];

function getInitials(name: string | undefined | null): string {
  if (!name) return 'AB';
  return name.trim().split(/\s+/).map(w => w[0]?.toUpperCase() ?? '').join('').slice(0, 2) || 'AB';
}

export function DashboardNav({ fullName, memberYear, offerCount }: Props) {
  const pathname = usePathname();
  const initials = getInitials(fullName);

  return (
    <aside style={{
      display: 'flex', flexDirection: 'column',
      borderRight: '1px solid #E8E8E4',
      padding: '32px 0',
      position: 'sticky', top: '60px',
      height: 'calc(100vh - 60px)',
      background: '#fff',
    }}>
      {/* User info */}
      <div style={{ padding: '0 24px 24px', borderBottom: '1px solid #E8E8E4', marginBottom: '8px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          background: '#0a0a0a', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '13px', fontWeight: 700,
          color: '#E8FF4D', marginBottom: '10px',
        }}>
          {initials}
        </div>
        <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '2px' }}>
          {fullName}
        </div>
        <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#999' }}>
          Seller · Member since {memberYear}
        </div>
      </div>

      {/* Nav items */}
      {NAV_ITEMS.map(item => {
        const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const isOffers = item.href === '/dashboard/offers';
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 24px',
              fontSize: '13px',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? '#0a0a0a' : '#666',
              borderLeft: `2px solid ${isActive ? '#0a0a0a' : 'transparent'}`,
              background: isActive ? '#FAFAF8' : 'transparent',
              textDecoration: 'none',
              position: 'relative',
            }}
          >
            <span style={{ opacity: isActive ? 1 : 0.4, flexShrink: 0, display: 'flex' }}>
              {item.icon}
            </span>
            {item.label}
            {isOffers && offerCount > 0 && (
              <span style={{
                marginLeft: 'auto',
                fontSize: '9px', fontWeight: 700,
                background: '#0a0a0a', color: '#fff',
                padding: '2px 6px', letterSpacing: '0.04em',
              }}>
                {offerCount}
              </span>
            )}
          </Link>
        );
      })}

      {/* New listing button — pushed to bottom */}
      <Link
        href="/sell/new"
        style={{
          margin: 'auto 24px 0',
          background: '#E8FF4D', color: '#0a0a0a',
          padding: '11px 0',
          fontSize: '11px', fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          textDecoration: 'none',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: '6px',
        }}
      >
        + New listing
      </Link>
    </aside>
  );
}
