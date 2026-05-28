# Seller Flow — Context File
**Owner:** Person 1
**Tool:** AI coding tool
**Branch:** feature/seller-flow
**Last updated:** 2026-05-28

---

## What This Feature Does

Lets a seller create a listing from scratch and manage it after it goes live.
Covers: Sell With Us landing page, 6-step listing intake form with draft
auto-save, photo upload, condition grading, inclusions checklist, pricing
with oracle, negotiation settings, submission to review queue, and the full
seller dashboard (7 sections).

---

## Current Status

```
[x] Sell With Us landing page — /sell/page.tsx
[x] 6-step listing intake form UI — /sell/new/page.tsx (UI complete, backend wired)
[x] Supabase client files — src/lib/supabase/client.ts, server.ts, admin.ts
[x] Auth middleware — src/middleware.ts (protects /sell/new, /sell/draft, /dashboard)
[x] Login page — /login (email OTP via Supabase Auth)
[x] POST /api/listings — creates listing with status=pending on submit
[x] POST /api/upload — uploads photos to Supabase Storage (listings bucket)
[ ] Auto-save draft on step completion (deferred — next session)
[ ] GET/PATCH /api/listings/[id] (deferred — needed for auto-save)
[ ] Seller dashboard — /dashboard (7 sections)
[ ] Dashboard: My Listings tabs
[ ] Dashboard: Offers & Negotiations
[ ] Dashboard: Order Tracking
[ ] Dashboard: Payouts & Earnings
[ ] Dashboard: Activity feed
[ ] Dashboard: Account & Trust
```

---

## Files Created

```
src/app/(main)/sell/page.tsx                    ✓ done
src/app/(main)/sell/new/page.tsx                ✓ done (UI + backend wired)
src/app/(auth)/login/page.tsx                   ✓ done
src/middleware.ts                               ✓ done
src/lib/supabase/client.ts                      ✓ done
src/lib/supabase/server.ts                      ✓ done
src/lib/supabase/admin.ts                       ✓ done
src/app/api/listings/route.ts                   ✓ done (POST only)
src/app/api/upload/route.ts                     ✓ done

src/app/(main)/sell/draft/[id]/page.tsx         [ ] not started
src/app/(main)/dashboard/page.tsx               [ ] not started
src/app/(main)/dashboard/listings/page.tsx      [ ] not started
src/app/(main)/dashboard/offers/page.tsx        [ ] not started
src/app/(main)/dashboard/orders/page.tsx        [ ] not started
src/app/(main)/dashboard/payouts/page.tsx       [ ] not started
src/app/(main)/dashboard/account/page.tsx       [ ] not started
src/components/forms/PhotoUpload.tsx            [ ] not started
src/components/forms/PriceInput.tsx             [ ] not started
src/components/forms/ConditionSelector.tsx      [ ] not started
src/components/forms/ProductSearch.tsx          [ ] not started
src/components/forms/AccessoryChecklist.tsx     [ ] not started
src/app/api/listings/[id]/route.ts              [ ] not started
```

---

## Database Tables This Feature Uses

| Table | Operation | Notes |
|-------|-----------|-------|
| listings | INSERT, UPDATE, SELECT | All listing operations |
| products | SELECT, INSERT | Product search + manual entry |
| offers | SELECT, PATCH | Accept/decline offers |
| orders | SELECT | View order status |
| price_history | SELECT | Show price oracle |
| users | SELECT, UPDATE | Seller profile, UPI, availability |
| notifications | SELECT | Activity feed |

---

## Supabase Setup Done

- Project URL: https://qgjpfehmporhjfkblrbj.supabase.co
- Schema applied: supabase/schema.sql (all 13 tables + triggers + RLS)
- Storage bucket: `listings` (public)
- Auth trigger: `on_auth_user_created` → inserts into public.users on signup
- phone column: made NULLABLE (collected in profile completion later)
- Keys in .env.local (gitignored)

---

## Key Architecture Decisions Made

### Auth
- Email OTP only for now (phone OTP requires Twilio — deferred)
- `phone` column made nullable; phone collected in profile completion
- Middleware protects: /sell/new, /sell/draft, /dashboard
- `handle_new_auth_user` trigger creates public.users row on auth signup

### Listing submission
- Single-submit approach: all 6 steps are local React state, everything
  saves to DB in one shot when "Submit for Review" is clicked
- Auto-save per step (draft to DB on each Continue) is DEFERRED — next session
- Photos upload first via POST /api/upload, then listing created with URLs

### Security
- floor_price: collected from seller in form, sent to API, stored in DB,
  but NEVER returned in any API response (excluded from .select())
- upload route uses admin client (bypasses storage RLS) but validates auth first
- listings RLS: sellers can only read/insert/update their own rows

### Form
- Step state: single React page (not URL-per-step)
- Product search: currently manual entry only (DB search deferred)
- Price oracle: mock data (real price_history query deferred)
- Inclusions: stored as Record<string, boolean> JSONB
- Condition checklist: stored as comma-separated string in condition_notes

### Slug
- Format: {brand-lowercase-alphanum}-{4-random-digits} e.g. moondrop-2394
- Generated server-side on listing creation
- Unique constraint in DB — collision extremely unlikely with 4 digits

---

## Known Issues / Watch Out

- Auth trigger "database error saving new user": was caused by phone NOT NULL
  constraint. Fixed by ALTER TABLE + updated trigger to omit phone column.
  If it recurs: re-run the trigger function with SET search_path = public.
- The (main) route group has no layout.tsx — inherits root layout (Nav always shown).
  When adding auth-gating to seller routes, a layout.tsx will be needed here.

---

## Next Session Starts Here

Dashboard overview page at /dashboard/page.tsx.
Must check auth (redirect to /login if not logged in — middleware handles this).
Show: active listings count, total earnings, pending payouts, active offers.
Query the listings table for seller's own listings.
If ?submitted=1 in URL, show a success banner ("Under review — 2–4 hours").

---

## Decisions Made In This Feature

- Auto-save triggers on step completion, not on timer
- Photos stored at: listings/{user_id}/{timestamp}_{random}.{ext} in Supabase storage
- Draft slug format: {brand-lowercase}-{4-random-digits} e.g. moondrop-2394
- Negotiation default: OFF — seller must opt in
- floor_price never leaves the server — excluded from all client responses
- Price warning is soft — seller is informed but not blocked
- No counter-offers — accept or decline only
- Active negotiation windows unaffected by price edits
- Parallel negotiations: multiple accepted offers, first to pay wins
- Email OTP used (not phone OTP) — phone OTP needs Twilio
- Single-submit approach for V1 (no per-step auto-save yet)
