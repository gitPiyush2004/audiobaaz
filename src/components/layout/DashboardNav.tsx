'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/dashboard',          label: 'Overview' },
  { href: '/dashboard/listings', label: 'My Listings' },
  { href: '/dashboard/offers',   label: 'Offers' },
  { href: '/dashboard/orders',   label: 'Orders' },
  { href: '/dashboard/payouts',  label: 'Payouts' },
  { href: '/dashboard/activity', label: 'Activity' },
  { href: '/dashboard/account',  label: 'Account' },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="shrink-0 sm:w-44">
      <ul className="space-y-0.5">
        {links.map(({ href, label }) => {
          const active = href === '/dashboard'
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

      <div className="mt-6 border-t border-border pt-6">
        <Link
          href="/sell/new"
          className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-accent text-sm font-semibold text-black transition-all hover:bg-accent-hover"
        >
          + New listing
        </Link>
      </div>
    </nav>
  );
}
