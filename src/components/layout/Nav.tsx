import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils/cn";
import { ProfileMenu } from "@/components/layout/ProfileMenu";

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

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export async function Nav() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile: { full_name: string | null; city: string | null } | null = null;
  let offerCount = 0;

  if (user) {
    const [{ data }, { count: offers }, { count: orders }] = await Promise.all([
      supabase.from("users").select("full_name, city").eq("id", user.id).single(),
      supabase.from("offers").select("*", { count: "exact", head: true }).eq("buyer_id", user.id),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("buyer_id", user.id),
    ]);
    profile    = data;
    offerCount = (offers ?? 0) + (orders ?? 0);
  }

  const fullName  = profile?.full_name ?? "";
  const initials  = fullName ? getInitials(fullName) : "?";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-bg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Audiobaaz home">
          <span className="font-heading text-xl font-bold tracking-tight text-foreground">
            audio<span className="text-accent">baaz</span>
          </span>
        </Link>

        <nav className="flex items-center gap-4">
          <Link href="/browse" className={navLinkClass}>Browse</Link>

          {user ? (
            <ProfileMenu
              initials={initials}
              fullName={fullName || "Your account"}
              city={profile?.city ?? undefined}
              offerCount={offerCount}
            />
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
