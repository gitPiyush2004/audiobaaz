# Admin Panel — Context File
**Owner:** Person 3
**Branch:** feature/admin-panel (merged); remaining V1 admin work (orders monitor, dispute → refund wiring) lands on `feature/order-lifecycle-shipping`
**Last updated:** 2026-05-30

---

## What This Feature Does

Internal tool for the Audiobaaz team to review and approve listings,
manage disputes, monitor orders, manage users, and trigger payouts.
Accessible only to users with role = 'admin'. Lives at /admin/*.

---

## Current Status

```
[x] Admin layout + role gate — src/app/admin/layout.tsx
[x] AdminNav sidebar — src/components/layout/AdminNav.tsx
[x] Overview dashboard — src/app/admin/page.tsx (4 live stat cards)
[x] Listing review queue — src/app/admin/listings/page.tsx
[x] Single listing review — src/app/admin/listings/[id]/page.tsx
[x] Approve/reject API — src/app/api/admin/listings/[id]/review/route.ts
[x] Disputes queue — src/app/admin/disputes/page.tsx
[x] Single dispute resolution — src/app/admin/disputes/[id]/page.tsx
[x] Resolve dispute API — src/app/api/admin/disputes/[id]/resolve/route.ts
[x] Users list + search — src/app/admin/users/page.tsx
[x] User detail + actions — src/app/admin/users/[id]/page.tsx
[x] User management API — src/app/api/admin/users/[id]/route.ts
[x] Seller payouts queue + history — src/app/admin/payouts/page.tsx
[x] Trigger payout API — src/app/api/admin/payouts/[id]/trigger/route.ts
[x] middleware.ts updated — /admin added to protected paths
[ ] Orders monitor — stub only, not built
[x] Bug fix: all admin page components switched from createClient() to createAdminClient() — pages were returning empty data due to RLS blocking non-owner reads
```

---

## Files Created

```
src/app/admin/layout.tsx                              ✓ done
src/app/admin/page.tsx                                ✓ done
src/app/admin/listings/page.tsx                       ✓ done
src/app/admin/listings/[id]/page.tsx                  ✓ done
src/app/admin/listings/[id]/ReviewActions.tsx         ✓ done
src/app/admin/disputes/page.tsx                       ✓ done
src/app/admin/disputes/[id]/page.tsx                  ✓ done
src/app/admin/disputes/[id]/ResolveActions.tsx        ✓ done
src/app/admin/users/page.tsx                          ✓ done
src/app/admin/users/[id]/page.tsx                     ✓ done
src/app/admin/users/[id]/UserActions.tsx              ✓ done
src/app/admin/orders/page.tsx                         stub only
src/app/admin/payouts/page.tsx                        ✓ done
src/app/admin/payouts/PayoutTrigger.tsx               ✓ done
src/components/layout/AdminNav.tsx                    ✓ done
src/app/api/admin/listings/[id]/review/route.ts       ✓ done
src/app/api/admin/disputes/[id]/resolve/route.ts      ✓ done
src/app/api/admin/users/[id]/route.ts                 ✓ done
src/app/api/admin/payouts/[id]/trigger/route.ts       ✓ done
```

---

## Database Tables This Feature Uses

| Table | Operation | Notes |
|-------|-----------|-------|
| listings | SELECT, UPDATE | Review queue, approve/reject |
| listing_reviews | INSERT | Log every review action |
| orders | SELECT, UPDATE | Monitor orders, trigger payouts |
| disputes | SELECT, UPDATE | Review and resolve |
| users | SELECT, UPDATE | Manage accounts, scores |
| payments | SELECT | Payment status (not yet built) |
| notifications | INSERT | Send Telegram alerts |

---

## Key Business Logic Implemented

### Route protection
- `middleware.ts` — `/admin` added to protected paths (redirects unauthenticated to login)
- `admin/layout.tsx` — server-side role check via Supabase, redirects non-admins to `/`
- All API routes double-check `role === 'admin'` independently

### Listing review
- Queue: `status = 'pending'`, oldest first
- 5-point checklist must be fully checked before Approve button enables
- Approve → `status = 'approved'`, Reject → `status = 'rejected'` + `rejection_reason`
- Every action logged in `listing_reviews` table
- Telegram sent to seller on both outcomes
- `floor_price` visible to admin (server-side only, excluded from buyer-facing APIs)

### Dispute resolution
- Resolution options: `full_refund` / `partial_refund` / `rejected`
- Partial refund: input in ₹, stored internally as paise
- Trust score adjustment: loser gets -5 (floored at 0)
- Order status updated: `completed` (dispute rejected) or `refunded`
- Telegram sent to both buyer and seller

### User management
- Search by name, email, phone (`?q=` query param)
- Actions: suspend / reactivate / add strike / promote to admin
- Guards: cannot perform actions on own account, validates current state
- Scores displayed with colour coding: green ≥80, amber ≥50, red <50

### Payouts
- Queue: `status = 'completed'` + `payout_status = 'pending'`
- Blocks trigger if seller has no UPI ID
- Sets `processing` first to prevent double-trigger
- V1: marks `paid` immediately (manual UPI transfer) with reference ID `PAY-XXXXXXXX-timestamp`
- V2 slot: Razorpay Payouts API integration
- Telegram sent to seller with amount, UPI ID, and reference

---

## Key Invariants — Never Break These

- **Role check is always server-side** — layout.tsx + every API route independently verify `role === 'admin'`
- **floor_price visible to admin** — it's excluded from buyer-facing APIs but admin needs it for price sanity check
- **Payout double-trigger prevention** — API sets `payout_status = 'processing'` before updating to `paid`
- **listing_reviews log is append-only** — never update or delete, only INSERT

---

## Dependencies On Other Features

| What | Owner | Notes |
|------|-------|-------|
| `PATCH /api/listings/[id]` | Person 1 | Admin uses its own `/api/admin/listings/[id]/review` route — no overlap |
| `src/lib/supabase/server.ts` | Person 1 | Used in all admin server components |
| `src/lib/supabase/admin.ts` | Person 1 | Used in all admin API routes (bypasses RLS) |
| `src/lib/telegram/index.ts` | Person 1 | Used for seller/buyer notifications |
| `src/middleware.ts` | Person 1 | Added `/admin` to protected paths — coordinate before modifying |

---

## What Other Features Can Use From Here

- `AdminNav` — `src/components/layout/AdminNav.tsx` — if admin gains more sections
- Admin API pattern — role double-check in every route is the established pattern

---

## Next Session Starts Here

Core admin panel is complete and merged to `dev`. End-to-end verified
with seller flow (listing submitted → admin queue → approve/reject).

Remaining V1 admin work has been **consolidated onto
`feature/order-lifecycle-shipping`** rather than continued on a
sibling branch (see `docs/BRANCHING.md` Rule 1: one active branch
for remaining V1 transaction-engine work). Tasks waiting on that
branch:

1. **Orders monitor** — `src/app/admin/orders/page.tsx` is currently
   a stub. Build a list/filter view that surfaces stuck refunds,
   stuck shipments (in `created`/`picked_up` for >N days), orders
   past inspection without payout. Read from `orders`, `payments`,
   `shipments`, `disputes` via `createAdminClient()`.
2. **Dispute → refund wiring.** When admin resolves a dispute with
   `full_refund` or `partial_refund`, call `initiate_refund()` (and
   later `record_refund_outcome()` once the gateway-side refund
   completes). The current `/api/admin/disputes/[id]/resolve` route
   adjusts `orders.status` and trust scores but does not yet trigger
   a real money refund. The PaymentProvider abstraction
   (`src/lib/payments/`) lets this work cleanly for both real Razorpay
   and DevPaymentProvider environments.
3. **Manual escrow release.** Admin button on a `delivered`/`inspection`
   order past its `inspection_expires_at` window → flips order to
   `completed` + `payout_status='pending'` (ready for the Payouts
   queue). The 48h auto-release worker is V2.
4. **Real Razorpay Payouts API integration** in
   `src/app/api/admin/payouts/[id]/trigger/route.ts` — V2 slot, not
   blocking V1 launch.
5. **Add `/admin` link to `Nav.tsx`** for users with `role = 'admin'`
   (coordinate with Person 1).

These all benefit from the `OrderTimeline` and `ShipmentTracking`
components shipped on `feature/order-lifecycle-shipping` — the admin
order detail page can reuse them directly.

## Known Issues Fixed (historical)

- **RLS bug**: All admin page server components were using `createClient()` (anon key, RLS-bound) instead of `createAdminClient()` (service role). RLS policies only allow users to read their own listings/orders/disputes, so the entire admin panel was returning empty data. Fixed in commit `e0d1cb5` on `feature/admin-panel`, synced to dev.
- **Vercel build lint failures**: Twelve `@typescript-eslint/no-explicit-any` errors across `src/app/admin/disputes/[id]/page.tsx`, `src/app/admin/payouts/page.tsx`, `src/app/api/admin/disputes/[id]/resolve/route.ts`, and `src/app/api/admin/payouts/[id]/trigger/route.ts` were blocking Vercel deployment of the `dev` branch. Resolved in commit `e0d84e4` by introducing a typed `pickOne<T>(rel)` helper at `src/lib/utils/relations.ts` and replacing the `as any` Supabase nested-relation casts with typed `pickOne<RowType>(...)` calls. The unused `router` import in `src/app/(auth)/onboarding/page.tsx` was also removed in the same commit. Four `<img>` warnings remain (non-blocking) — replacing them with `next/image` is a separate UI pass.

---

## Decisions Made In This Feature

- Admin panel lives in main repo, not a separate app
- Role check is server-side in layout.tsx AND in every API route — defence in depth
- Admin has its own API routes (`/api/admin/*`) — never reuses seller/buyer routes
- Listing review uses a separate `listing_reviews` log table — full audit trail
- Dispute resolution adjusts trust scores immediately (-5 to loser)
- Payouts are manual V1 — processing flag prevents double-trigger
- Orders page is stubbed — not needed for core V1 admin flow
