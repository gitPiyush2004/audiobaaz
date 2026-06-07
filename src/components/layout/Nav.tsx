import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProfileMenu } from "@/components/layout/ProfileMenu";
import { Logo } from "@/components/layout/Logo";

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

  const fullName = profile?.full_name ?? "";
  const initials = fullName ? getInitials(fullName) : "?";

  return (
    <header className="sticky top-0 z-50 w-full" style={{ background: '#FFFFFF' }}>
      {/* Main bar */}
      <div
        style={{ height: '60px', borderBottom: '1px solid #E8E8E8' }}
        className="flex w-full items-center"
      >
        <div className="flex w-full items-center justify-between" style={{ padding: '0 40px' }}>
          <Logo size={38} />

          <nav className="flex items-center gap-6">
            {user ? (
              <ProfileMenu
                initials={initials}
                fullName={fullName || "Your account"}
                city={profile?.city ?? undefined}
                offerCount={offerCount}
              />
            ) : (
              <>
                <Link
                  href="/login"
                  style={{ fontSize: '13px', fontWeight: 500, color: '#333' }}
                  className="transition-colors hover:text-[#0a0a0a]"
                >
                  Log in
                </Link>
                {/* Accent instance 1/2 — navbar sell button */}
                <Link
                  href="/sell"
                  style={{
                    background: '#E8FF4D',
                    color: '#0a0a0a',
                    fontWeight: 700,
                    fontSize: '11px',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    padding: '8px 20px',
                    borderRadius: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                  className="transition-opacity hover:opacity-80"
                >
                  Sell With Us
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>

    </header>
  );
}
