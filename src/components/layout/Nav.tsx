import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils/cn";

const navLinkClass = cn(
  "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
);

const btnSecondaryClass = cn(
  "inline-flex items-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium",
  "text-foreground transition-colors hover:bg-surface-2"
);

const btnPrimaryClass = cn(
  "inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold",
  "text-black transition-all hover:bg-accent-hover active:scale-[0.98]"
);

export async function Nav() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-bg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Audiobaaz home">
          <span className="font-heading text-xl font-bold tracking-tight text-foreground">
            audio<span className="text-accent">baaz</span>
          </span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-4">
          <Link href="/browse" className={navLinkClass}>Browse</Link>

          {user ? (
            <>
              <Link href="/dashboard" className={btnSecondaryClass}>Dashboard</Link>
              <Link href="/sell/new" className={btnPrimaryClass}>+ New Listing</Link>
            </>
          ) : (
            <>
              <Link href="/login" className={btnSecondaryClass}>Log in</Link>
              <Link href="/sell" className={btnPrimaryClass}>Sell With Us</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
