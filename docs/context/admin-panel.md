# Admin Panel — Context File
**Owner:** Person 3
**Branch:** main (audiobaaz-app repo)
**Last updated:** 2026-06-08

---

## MOVED — Admin panel is now a separate Next.js app

The admin panel has been extracted from this repository into its own standalone Next.js application.

**New repo:** `github.com/audiobaaz/audiobaaz-app`
**Live at:** `https://app.audiobaaz.com`
**Deployed via:** Dokploy (same VPS as main app)

---

## What Was Removed From This Repo

The following were deleted from `audiobaaz` on `feature/admin-redesign`:

```
src/app/admin/                        ← deleted
src/app/api/admin/                    ← deleted
src/components/layout/AdminNav.tsx    ← deleted
```

`/admin` was also removed from the protected paths list in `src/middleware.ts`.

---

## Why

Admin and (future) merchant tooling lives at `app.audiobaaz.com` as a
standalone internal portal. Keeping it in the consumer-facing repo
meant the admin surface area (service role key usage, admin-only API
routes, RLS bypass) was co-located with the public app. Separating it:

- Cleaner security boundary
- Independent deploy cadence for admin vs consumer app
- Portal landing at `app.audiobaaz.com` supports future Merchant login (V2)

---

## audiobaaz-app Structure

```
app/
├── page.tsx                    # Portal landing — Admin | Merchant cards
├── login/page.tsx              # Email + password auth (no OTP, no Google)
├── auth/signout/route.ts       # Sign out (clears session, redirects to /)
└── admin/
    ├── layout.tsx              # Server-side role gate — fetches user, passes to AdminNav
    ├── page.tsx                # Overview dashboard (4 stat cards)
    ├── listings/               # Review queue + thumbnails + review history + detail + approve/reject
    ├── disputes/               # Disputes queue + detail + 3-outcome resolver
    ├── users/                  # Split Team/Users sections + detail + suspend/strike/promote
    ├── payouts/                # Razorpay-active info stub (manual trigger removed)
    └── orders/                 # STUB — orders monitor not yet built

app/api/admin/
    ├── listings/[id]/review/   # POST approve/reject — logs to listing_reviews (append-only)
    ├── disputes/[id]/resolve/  # POST resolve dispute (full_refund / partial_refund / rejected)
    ├── users/[id]/             # PATCH suspend/reactivate/strike/promote
    └── payouts/[id]/trigger/   # V2 SLOT — Razorpay Payouts API goes here; V1 manual code inside but no UI calls it
```

---

## Auth in the Portal

- **Email + password only** — no OTP, no Google OAuth, no OAuth callback
- Admin accounts are created manually in Supabase Dashboard
- After sign-in, role is checked server-side in `layout.tsx` AND in every API route
- Wrong credentials → "Invalid email or password."
- Valid credentials but `role !== 'admin'` → "You do not have admin access." + signs out
- Middleware redirects authenticated users away from `/` and `/login` directly to `/admin` (no redirect loop)
- `app/auth/callback/route.ts` was deleted 2026-06-08 — portal never used OAuth
- Uses the same Supabase project as the main app

---

## Remaining Admin Work (V1 + V2)

1. **Orders monitor** — `app/admin/orders/page.tsx` is a stub. Build list/filter view for stuck refunds, stuck shipments, orders past inspection without payout. (V1)
2. **Dispute → refund wiring** — resolving a dispute updates DB status but does not yet call `initiate_refund()` on the PaymentProvider. (V2 slot)
3. **Real Razorpay Payouts API** — implement in `app/api/admin/payouts/[id]/trigger/route.ts` (V2 slot already exists). Nav link + info page are already live. (V2)
4. **Manual escrow release** — admin button on delivered/inspection orders past `inspection_expires_at`. (V2)
5. **PayoutTrigger.tsx** — orphaned client component (not imported anywhere); safe to delete when cleaning up.

---

## Design System (audiobaaz-app)

All admin pages use **inline styles** — not Tailwind class names. The dark-theme Tailwind tokens (`text-foreground`, `font-heading`, etc.) from the scaffolded config are incompatible with the light-theme portal.

| Token | Value |
|-------|-------|
| Background | `#FFFFFF` |
| Accent | `#E8FF4D` |
| Text | `#0A0A0A` |
| Border | `#E8E8E8` |
| Surface | `#F5F5F5` |
| Font | `"Helvetica Neue", Helvetica, Arial, sans-serif` |
| Border radius | `0` everywhere |

Primary CTA buttons: `background: #0a0a0a, color: #E8FF4D`
Destructive/secondary: `background: #F5F5F5, color: #0a0a0a`
Accent action (promote): `background: #E8FF4D, color: #0a0a0a`

---

## Key Invariants (still apply in audiobaaz-app)

- All money in **paise** (₹ × 100)
- `floor_price` visible to admin only — never in buyer-facing APIs
- `listing_reviews` is append-only — never UPDATE or DELETE
- Role check is server-side in layout.tsx AND in every API route
- Payout double-trigger prevention via `processing` state
- `createAdminClient()` (service role) used for all DB reads/writes — bypasses RLS

---

## Build Notes (audiobaaz-app)

- **Node 20** — `.node-version` file at repo root forces Nixpacks to Node 20. Without it, Nixpacks picks Node 18 and the build fails.
- **Image domains** — `next.config.mjs` allowlists both `*.supabase.co` AND `*.audiobaaz.com`. Supabase runs on the custom domain `supabase-dev.audiobaaz.com`; photos 403 if only `*.supabase.co` is listed.
- **force-dynamic** — all admin pages export `export const dynamic = 'force-dynamic'` (reads cookies at render time).

---

## Decisions

- Admin panel lives in `audiobaaz-app`, not in the main `audiobaaz` repo
- Portal uses email + password auth — no magic links, no Google, no account creation from UI
- No OAuth callback — `app/auth/callback/route.ts` deleted 2026-06-08
- `app.audiobaaz.com` is the permanent home; merchant login will share the same portal in V2
- Same Supabase project as main app — shared users table, shared role system
- Payouts are via Razorpay Payouts API — manual UPI trigger removed from UI 2026-06-08
