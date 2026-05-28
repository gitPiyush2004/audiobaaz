'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/admin',           label: 'Overview' },
  { href: '/admin/listings',  label: 'Listings' },
  { href: '/admin/orders',    label: 'Orders' },
  { href: '/admin/disputes',  label: 'Disputes' },
  { href: '/admin/users',     label: 'Users' },
  { href: '/admin/payouts',   label: 'Payouts' },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="shrink-0 sm:w-44">
      <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-widest text-text-2">
        Admin
      </p>
      <ul className="space-y-0.5">
        {links.map(({ href, label }) => {
          const active = href === '/admin'
            ? pathname === href
            : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={[
                  'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-surface text-foreground'
                    : 'text-muted-foreground hover:bg-surface hover:text-foreground',
                ].join(' ')}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
