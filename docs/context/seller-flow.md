# Seller Flow — Context File
**Owner:** Person 1
**Tool:** AI coding tool
**Branch:** feature/seller-flow (merged); seller dashboard order detail + shipment flow on `feature/ui-redesign`
**Last updated:** 2026-06-03

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
[x] Auth middleware — src/middleware.ts (protects /sell/new, /sell/draft, /dashboard, /onboarding)
[x] Login page — /login (email magic link via Supabase Auth + Google OAuth — commit 15ff3f1)
[x] Auth callback — /auth/callback (exchanges code; redirects to /onboarding if full_name not set, else to destination)
[x] Onboarding page — /onboarding (mandatory on first login; collects first name, last name, phone +91, telegram username, city)
[x] POST /api/listings — creates listing with status=pending on submit
[x] PATCH /api/listings/[id] — delist + status transitions (incl. rejected→draft for resubmit)
[x] POST /api/upload — uploads photos to Supabase Storage (listings bucket)
[x] PATCH /api/offers/[id] — accept/decline offers
[x] PATCH /api/users/me — update profile (full_name, city, pincode, upi_id, availability, phone, telegram_chat_id)
[x] Dashboard layout — shared sidebar with active link highlighting
[x] Dashboard: Overview — stat cards + recent listings + submitted banner
[x] Dashboard: My Listings — tabbed (Live/Pending/Rejected/Draft/Sold/Delisted) + Delist + rejection reason banner + Edit & resubmit
[x] Dashboard: Offers — accept/decline, countdown, past offers
[x] Dashboard: Orders — status timeline
[x] Dashboard: Payouts — UPI management + earnings history
[x] Dashboard: Activity — Telegram notification log
[x] Dashboard: Account — profile form, availability, Telegram prompt, seller rating
[x] Draft resume page — /sell/draft/[id] (pre-populates form, PATCHes existing row)
[x] Auto-save draft on step completion — fires after steps 1→2, 2→3, 3→4; creates draft on first save, PATCHes on subsequent; uses savedDraftIdRef (no stale closure)
[x] Real price oracle — GET /api/price-oracle?model=X&brand=Y queries price_history ILIKE; fetched on entering step 5; falls back to empty state gracefully
[x] Product search — GET /api/products/search?q=X uses ilike on name/brand; autocomplete dropdown in step 1; selecting fills brand/name/category
[x] Telegram lib — src/lib/telegram/index.ts; wired into POST /api/listings (listing submitted) and PATCH /api/offers/[id] (offer accepted/declined); no-ops if TELEGRAM_BOT_TOKEN is empty
[x] Nav redesign — profile avatar (initials) replaces all auth links for logged-in users; dropdown shows My Orders (dynamic offer count from DB), Seller Dashboard, Profile, Sign out
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
src/app/api/listings/route.ts                   ✓ done (POST — full submit + saveAsDraft draft creation + Telegram notify)
src/app/api/listings/[id]/route.ts              ✓ done (PATCH — resubmit + saveDraft partial update + status transitions + price update)
src/app/api/offers/[id]/route.ts                ✓ done (PATCH — accept/decline + Telegram notify buyer)
src/app/api/price-oracle/route.ts               ✓ done (GET — queries price_history ILIKE product_name)
src/app/api/products/search/route.ts            ✓ done (GET — queries products ilike name/brand)
src/app/api/upload/route.ts                     ✓ done
src/lib/telegram/index.ts                       ✓ done (sendTelegramMessage — no-ops if BOT_TOKEN empty)

src/app/(main)/sell/draft/[id]/page.tsx                    ✓ done
src/app/(main)/dashboard/page.tsx                          ✓ done
src/app/(main)/dashboard/listings/page.tsx                 ✓ done (Rejected tab + rejection reason + resubmit)
src/app/(main)/dashboard/listings/ResubmitButton.tsx       ✓ done
src/app/(main)/dashboard/offers/page.tsx                   ✓ done
src/app/(main)/dashboard/orders/page.tsx                   ✓ done
src/app/(main)/dashboard/payouts/page.tsx                  ✓ done
src/app/(main)/dashboard/account/page.tsx                  ✓ done
src/app/(auth)/onboarding/page.tsx                         ✓ done
src/components/layout/ProfileMenu.tsx                      ✓ done
src/app/api/dev/sign-in/route.ts                           ✓ done (dev only, blocked in production)
src/app/auth/callback/route.ts                             ✓ updated (handles PKCE code + token_hash flows)
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
- Email OTP (magic link) for now (phone OTP requires Twilio — deferred)
- Google OAuth added to login page (commit 15ff3f1) — preferred long-term path because it sidesteps Supabase email-OTP rate limits and lowers signup friction. Magic link kept as fallback.
- `phone` column made nullable; phone collected in profile completion
- Middleware protects: /sell/new, /sell/draft, /dashboard
- `handle_new_auth_user` trigger creates public.users row on auth signup

### Listing submission
- Auto-save: fires after steps 1→2, 2→3, 3→4 (fire-and-forget, non-blocking)
  - After step 1: POST /api/listings with saveAsDraft=true (creates draft row)
  - After steps 2, 3: PATCH /api/listings/[id] with saveDraft=true (partial update)
  - savedDraftIdRef (useRef) stores the draft ID to avoid stale closures
  - Photos are NOT auto-saved (file objects can't upload in background) — uploaded fresh on final submit
- Final submit: PATCHes with resubmit=true if effectiveDraftId exists, else POSTs new listing
- Photos upload first via POST /api/upload, then listing created/updated with URLs

### Security
- floor_price: collected from seller in form, sent to API, stored in DB,
  but NEVER returned in any API response (excluded from .select())
- upload route uses admin client (bypasses storage RLS) but validates auth first
- listings RLS: sellers can only read/insert/update their own rows

### Form
- Step state: single React page (not URL-per-step)
- Product search: autocomplete in step 1 via GET /api/products/search?q=X; selecting fills brand/name/category; degrades gracefully if products table is empty
- Price oracle: fetched from GET /api/price-oracle?model=X on entering step 5; falls back to empty state if no history
- Inclusions: stored as Record<string, boolean> JSONB
- Condition checklist: stored as comma-separated string in condition_notes

### Telegram
- src/lib/telegram/index.ts — sendTelegramMessage(chatId, html); no-ops silently if TELEGRAM_BOT_TOKEN is empty
- Wired in POST /api/listings (listing submitted → notify seller)
- Wired in PATCH /api/offers/[id] (offer accepted/declined → notify buyer)
- TELEGRAM_BOT_TOKEN is set in .env.local (currently empty — add real token when bot is ready)

### Slug
- Format: {brand-lowercase-alphanum}-{4-random-digits} e.g. moondrop-2394
- Generated server-side on listing creation
- Unique constraint in DB — collision extremely unlikely with 4 digits

---

## Key Invariants — Never Break These

- **Draft resume PATCHes the existing row** — never creates a new listing.
  `created_at` stays from the original submission; `updated_at` reflects the edit.
  Verified: DB shows 1 row with same UUID after resume + resubmit.

- **Pulled-back listings are invisible to admin** — status transitions from
  `pending → draft` on pull back. Admin review queue queries `status = 'pending'`
  only, so pulled-back listings never appear there. No extra logic needed.

- **floor_price never leaves the server** — excluded from all .select() calls
  in API responses. Seller sets it, it's stored, buyers never see it.

---

## Known Issues / Watch Out

- Auth trigger "database error saving new user": was caused by phone NOT NULL
  constraint. Fixed by ALTER TABLE + updated trigger to omit phone column.
  If it recurs: re-run the trigger function with SET search_path = public.
- The (main) route group has no layout.tsx — inherits root layout (Nav always shown).
  When adding auth-gating to seller routes, a layout.tsx will be needed here.

---

## What Other Features Can Use From Here

| What | Path | Notes for other teams |
|------|------|-----------------------|
| Listing status flow | `ENGINEERING.md` | draft→pending→approved→reserved→sold→completed. Admin only ever sees `pending`. |
| Offer status flow | `ENGINEERING.md` | pending→accepted→paid. First buyer to pay wins. |
| `floor_price` rule | `ENGINEERING.md` | Never returned in any API response. Server-side only. |
| `PATCH /api/offers/[id]` | `src/app/api/offers/[id]/route.ts` | Buyer flow: cancel offer. Admin: force-expire. Both need new RLS policies. |
| `POST /api/listings` | `src/app/api/listings/route.ts` | Seller-only. Buyer/admin should never call this. |
| `PATCH /api/listings/[id]` | `src/app/api/listings/[id]/route.ts` | Admin needs to add `pending→approved` and `pending→rejected` transitions here. Handles: resubmit, saveDraft (partial update), status transitions, price update. |
| `GET /api/price-oracle` | `src/app/api/price-oracle/route.ts` | Params: model, brand. Returns recent sold prices from price_history. Buyer-safe (no floor_price). |
| `GET /api/products/search` | `src/app/api/products/search/route.ts` | Params: q (min 2 chars), category (optional). Returns id, name, brand, model, category. |
| Telegram lib | `src/lib/telegram/index.ts` | `sendTelegramMessage(chatId, html)` — use for any notification. No-ops if BOT_TOKEN is empty. |
| `ListingForm` component | `src/components/forms/ListingForm.tsx` | Accepts `draftId?` + `initialData?`. Don't duplicate — extend if needed. |
| `Nav` component | `src/components/layout/Nav.tsx` | Auth-aware server component. Discuss before modifying. |
| Supabase helpers | `src/lib/supabase/client.ts`, `server.ts`, `admin.ts` | Use server.ts in API routes, client.ts in components, admin.ts for service-role only. |
| Auth middleware | `src/middleware.ts` | Protects `/sell/*` and `/dashboard`. Person 3 needs to add `/admin/*` protection here. |

---

## Next Session Starts Here

**Seller flow is COMPLETE for V1.** All features including onboarding and nav are done.

Remaining items (V1.5 / nice-to-have, not blocking launch):
1. Wire TELEGRAM_BOT_TOKEN once the bot is set up — the lib and calls are in place, just needs the token
2. Populate the `products` table — product search degrades gracefully, but needs data to be useful
3. Profile photo upload — onboarding currently uses initials avatar; Supabase Storage `avatars` bucket needed
4. Nav order count queries all-time offers + orders; could filter to active-only in future
5. Real Razorpay flow now wired via the PaymentProvider abstraction (`feature/order-lifecycle-shipping`). The historical `/api/checkout/mock` route is removed; CheckoutForm goes through `/api/payments/create` and selects RazorpayPaymentProvider or DevPaymentProvider via `PAYMENT_PROVIDER` env. Seller dashboard now has `/dashboard/orders/[orderId]` with a "Create shipment" action that calls `/api/shipping/create` (MockShippingProvider until Shiprocket credentials land).

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
