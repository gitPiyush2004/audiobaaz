'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface ProfileMenuProps {
  initials: string;
  fullName: string;
  city?: string;
  offerCount: number;
}

export function ProfileMenu({ initials, fullName, city, offerCount }: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-accent font-heading text-sm font-bold text-black ring-offset-bg transition-all hover:ring-2 hover:ring-accent/50 hover:ring-offset-2"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
          {/* identity header */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent font-heading text-sm font-bold text-black">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{fullName}</p>
              {city && <p className="truncate text-xs text-muted-foreground">{city}</p>}
            </div>
          </div>

          {/* links */}
          <nav className="py-1">
            {offerCount > 0 ? (
              <MenuLink href="/orders/purchases" onClick={() => setOpen(false)}>
                <span className="flex items-center justify-between">
                  My Orders
                  <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                    {offerCount}
                  </span>
                </span>
              </MenuLink>
            ) : (
              <div className="px-4 py-2">
                <p className="text-sm font-medium text-foreground">My Orders</p>
                <p className="text-xs text-muted-foreground">You have no orders yet.</p>
              </div>
            )}
            <MenuLink href="/dashboard" onClick={() => setOpen(false)}>Seller Dashboard</MenuLink>
            <MenuLink href="/dashboard/account" onClick={() => setOpen(false)}>Profile</MenuLink>
          </nav>

          {/* sign out */}
          <div className="border-t border-border py-1">
            <button
              onClick={signOut}
              className="w-full px-4 py-2 text-left text-sm text-error transition-colors hover:bg-surface-2"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block px-4 py-2 text-sm text-foreground transition-colors hover:bg-surface-2"
    >
      {children}
    </Link>
  );
}
