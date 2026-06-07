# Admin Panel — Context File
**Owner:** Person 3
**Branch:** feature/admin-redesign
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
├── auth/callback/route.ts      # Role check after OAuth (fallback)
├── auth/signout/route.ts       # Sign out
└── admin/
    ├── layout.tsx              # Server-side role gate
    ├── page.tsx                # Overview dashboard (4 stat cards)
    ├── listings/               # Review queue + detail + approve/reject
    ├── disputes/               # Disputes queue + detail + resolve
    ├── users/                  # User search + detail + actions
    ├── payouts/                # Payout queue + history + trigger
    └── orders/                 # STUB — orders monitor not yet built

app/api/admin/
    ├── listings/[id]/review/   # POST approve/reject
    ├── disputes/[id]/resolve/  # POST resolve dispute
    ├── users/[id]/             # PATCH user actions
    └── payouts/[id]/trigger/   # POST trigger payout
```

---

## Auth in the Portal

- **Email + password only** — no OTP, no Google OAuth
- Admin accounts are created manually in Supabase Dashboard
- After sign-in, role is checked client-side (fast feedback) and server-side in layout.tsx
- Wrong credentials → "Invalid email or password."
- Valid credentials but `role !== 'admin'` → "You do not have admin access." + signs out
- Uses the same Supabase project as the main app

---

## Remaining Admin Work (V1 + V2)

1. **Orders monitor** — `app/admin/orders/page.tsx` is a stub. Build list/filter view for stuck refunds, stuck shipments, orders past inspection without payout.
2. **Dispute → refund wiring** — resolving a dispute updates DB status but does not yet call `initiate_refund()` on the PaymentProvider. V2 slot.
3. **Real Razorpay Payouts API** — currently V1 manual (marks paid immediately with fake reference). V2.
4. **Manual escrow release** — admin button on delivered/inspection orders past `inspection_expires_at`. V2.

---

## Key Invariants (still apply in audiobaaz-app)

- All money in **paise** (₹ × 100)
- `floor_price` visible to admin only — never in buyer-facing APIs
- `listing_reviews` is append-only — never UPDATE or DELETE
- Role check is server-side in layout.tsx AND in every API route
- Payout double-trigger prevention via `processing` state
- `createAdminClient()` (service role) used for all DB reads/writes — bypasses RLS

---

## Decisions

- Admin panel lives in `audiobaaz-app`, not in the main `audiobaaz` repo
- Portal uses email + password auth — no magic links, no Google, no account creation from UI
- `app.audiobaaz.com` is the permanent home; merchant login will share the same portal in V2
- Same Supabase project as main app — shared users table, shared role system
