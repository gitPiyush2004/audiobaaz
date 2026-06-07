'use client';

import Link from 'next/link';
import { useSearchParams, usePathname } from 'next/navigation';
import { Suspense } from 'react';

const CATS = [
  { label: 'All',          href: '/browse' },
  { label: 'Headphones',   href: '/browse?category=headphone' },
  { label: 'IEMs',         href: '/browse?category=iem' },
  { label: 'Speakers',     href: '/browse?category=other' },
  { label: 'DACs',         href: '/browse?category=dac' },
  { label: 'Amplifiers',   href: '/browse?category=amp' },
  { label: 'Cables',       href: '/browse?category=cable' },
  { label: 'Turntables',   href: '/browse?category=source' },
  { label: 'Staff Picks',  href: '/browse?sort=rating_desc' },
] as const;

function CategoryLinks() {
  const pathname = usePathname();
  const params   = useSearchParams();
  const cat      = params.get('category') ?? '';
  const sort     = params.get('sort') ?? '';

  function isActive(href: string) {
    if (!pathname.startsWith('/browse')) return false;
    if (href === '/browse') return pathname === '/browse' && !cat && !sort;
    if (href.includes('sort=rating_desc')) return sort === 'rating_desc';
    return href.includes(cat) && !!cat;
  }

  return (
    <>
      {CATS.map(c => {
        const active = isActive(c.href);
        return (
          <Link
            key={c.href}
            href={c.href}
            style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: active ? '#0a0a0a' : '#999',
              padding: '13px 16px',
              borderBottom: active ? '2px solid #0a0a0a' : '2px solid transparent',
              whiteSpace: 'nowrap',
              textDecoration: 'none',
              transition: 'color 0.12s',
            }}
            className="hover:text-[#0a0a0a]"
          >
            {c.label}
          </Link>
        );
      })}
    </>
  );
}

export function CategoryNav() {
  return (
    <div style={{ borderBottom: '1px solid #E8E8E4', background: '#FFFFFF', overflowX: 'auto' }}
      className="scrollbar-none"
    >
      <div className="flex" style={{ padding: '0 40px' }}>
        <Suspense>
          <CategoryLinks />
        </Suspense>
      </div>
    </div>
  );
}
