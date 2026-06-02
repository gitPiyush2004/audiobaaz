# UI Redesign — Context File
**Branch:** feature/ui-redesign
**Last updated:** 2026-06-02 (session 3)
**Status:** VALIDATED — lifecycle runbook scenarios A–H all pass. Ready to merge to `dev`.

---

## What This Is

A parallel design exploration on `feature/ui-redesign`. The original dark theme remains intact on `dev` and all other feature branches. This branch is NOT merged to dev — it exists for team review and iteration.

Design direction: white editorial, full-bleed, typography-led. Reference: SSENSE + Grailed.

---

## Design Decisions (locked for this branch)

### Colors
```
Background:   #FFFFFF  (pure white, not warm white)
Surface:      #FFFFFF
Border:       #E8E8E4  (everywhere, 1px)
Text primary: #0a0a0a
Text mid:     #666666
Text muted:   #999999
Accent:       #E8FF4D  — used in EXACTLY 2 places:
                         1. Navbar "Sell With Us" button
                         2. Hero "Browse Listings" primary CTA
                         Nowhere else.
```

### Typography
- **Primary font**: Helvetica Neue, Helvetica, Arial (system font — no download needed, matches Grailed exactly)
- **Serif flourish**: Instrument Serif italic — used ONLY for `<em>audio obsessives.</em>` in the hero headline. One design flourish across the entire site.
- **Mono**: JetBrains Mono — prices and codes only
- No separate heading font. Helvetica at different weights IS the system.

### Layout
- Full-bleed sections — NO `max-w-*` or `mx-auto` containers anywhere
- Every section manages its own `padding: 0 40px` horizontally
- Nav, category strip, hero, stats, listings, trust, footer — all 40px from browser edge
- Border-radius: 0 on ALL interactive elements (buttons, inputs, badges)
- No box shadows anywhere

### Logo (`src/components/layout/Logo.tsx`)
- SVG at `viewBox="0 0 120 120"` — this is the fix that makes grooves visible at navbar size
- Vinyl spins after 600ms, arrows pulse after 900ms, wordmark fades in
- Hover: all arrows light up simultaneously
- Wordmark: `AUDIO` in #0a0a0a + `BAAZ` with #E8FF4D background highlight
- Props: `size` (default 38), `showWordmark` (default true), `wordmarkColor`

---

## Files Created / Modified

### New components
```
src/components/layout/Logo.tsx          Animated vinyl SVG + two-tone wordmark
src/components/layout/CategoryNav.tsx   Horizontal category strip below navbar
src/components/layout/HeroWaveform.tsx  Canvas waveform + floating review cards
src/components/layout/Ticker.tsx        Scrolling listing pill strip
src/components/layout/Footer.tsx        Minimal footer with Lapidaria credit
```

### Modified
```
src/app/globals.css          Light theme tokens, sharp-corner rule, hbw-* CSS,
                               driftL/driftR keyframes + login-row-* classes
src/app/layout.tsx           Instrument Serif added, DM Sans kept as fallback
src/app/page.tsx             Full homepage redesign (see Homepage Structure below)
src/app/(auth)/login/page.tsx  Two-column login redesign: dark panel with real
                               product photo cards (driftL/driftR rows), white form panel
src/components/layout/Nav.tsx            60px, full-bleed 40px, vinyl logo
src/components/layout/ProfileMenu.tsx   Avatar updated for light bg (#0a0a0a)
src/components/listing/ListingCard.tsx  Newspaper grid style, sharp corners
tailwind.config.ts           serif font family added (var(--font-serif))
```

### New static assets
```
public/images/signin-ie.png      IEM product photo (Audeze-style, black bg)
public/images/signin-hp.png      Headphone product photo (Bose QC35, black bg)
public/images/signin-sp.png      Speaker product photo (bookshelf, black bg)
public/signin-story.mp4          Sell page hero video (landscape)
public/signin-story-portrait.mp4 Sell page hero video (portrait/mobile)
```

### New components
```
src/app/(main)/sell/PayoutCalculator.tsx  Interactive payout calculator on sell page
src/app/(auth)/layout.tsx                 Auth layout wrapper
```

### Pages redesigned (light theme applied)
```
src/app/(main)/sell/page.tsx              Editorial sell landing + hero video + steps
src/app/(main)/dashboard/page.tsx         Seller dashboard home
src/app/(main)/dashboard/layout.tsx       Dashboard shell
src/app/(main)/dashboard/listings/        All listing management pages + action buttons
src/app/(main)/dashboard/offers/          Offer list + OfferActions
src/app/(main)/dashboard/orders/page.tsx  Orders list
src/app/(main)/dashboard/payouts/         Payouts page + UpiForm
src/app/(main)/dashboard/account/page.tsx Account settings
src/app/browse/page.tsx                   Browse / marketplace grid
src/app/admin/page.tsx                    Admin home
src/app/admin/layout.tsx                  Admin shell
src/app/admin/listings/page.tsx           Admin listings review
src/app/(auth)/onboarding/page.tsx        Two-column onboarding (session 2)
src/components/forms/ListingForm.tsx      6-step listing wizard redesign (session 2)
```

---

## Homepage Structure

```
Nav (60px, sticky)
  └─ Logo left | Browse · Log in · [Sell With Us] right

CategoryNav
  └─ All · Headphones · IEMs · Speakers · DACs · Amplifiers · Cables · Turntables · Staff Picks

Hero (1fr 1fr grid, border divider, min-height 480px)
  ├─ Left:  badge · h1 (serif italic em) · subtext · 2 CTAs
  └─ Right: HeroWaveform (canvas + 5 floating review cards)

Ticker (scrolling pill strip, fade edges)

Stats (3-col ruled grid)
  └─ 100% ESCROW-PROTECTED | Every listing CONDITION-GRADED | 48hr DISPUTE WINDOW

Listings section (5-col newspaper grid, 0 gap, ruled borders)
  └─ Real data from Supabase (createAdminClient, status=approved)

Trust pillars (01 · 02 · 03 editorial layout, 3-col ruled grid)

Footer (AUDIO[BAAZ] wordmark | © Lapidaria | About · How it works · Terms · Privacy)
```

---

## HeroWaveform Details

- Canvas resizes on every `draw()` frame (not ResizeObserver) — matches original HTML mockup pattern
- Bars: 56 bars, Gaussian envelope (taller centre), dual reflection (upper + lower halves)
- `startX = (W - totalBarsWidth) / 2` — always centred
- 5 review cards float in/out at staggered delays (600ms–9200ms first appearance)
- Neon dots on waveform centre line, repositioned every frame
- CSS for review cards lives in `globals.css` (avoids React hydration mismatch from `content: ''`)

---

## Source Files (mockups used for reference)
```
audiobaaz_logo.html      Original animated logo HTML
audiobaaz_mockup.html    Full page layout mockup
audiobaaz_waveform.html  Waveform + review cards panel mockup
```

---

## Login Page Design

Two-column layout, full viewport height:

```
Nav (60px) — Logo left | Browse · [Sell With Us] right

Left column (#0a0a0a):
  ├─ Eyebrow: green dot · "Managed · Verified · Trusted"
  ├─ Headline: "Serious gear." (900 weight) + italic serif "Waiting for you." (#E8FF4D)
  ├─ Two sliding card rows (CSS driftL 30s / driftR 24s, pauses on hover)
  │    Cards: real product photos, 190×154px image area, grade badge
  └─ Footer: "Sign in to browse all listings →"

Right column (#fff):
  └─ Welcome back · Sign in headline · Google OAuth button ·
     OR divider · email input · magic link submit · footer legal
```

Card row implementation:
- `.login-row-wrap` applies the mask-image fade on left/right edges
- `.login-row-track` / `.login-row-track-rev` hold doubled arrays for seamless loop
- Keyframes in `globals.css`: `driftL` (0→−50%) and `driftR` (−50%→0)
- Hover on wrapper pauses both track classes via CSS parent-child selector

---

## Onboarding Page (session 2)

Two-column layout matching the login page:

```
Nav (60px, sticky)

Left column (#0a0a0a):
  ├─ Eyebrow: green dot · "One-time setup"
  ├─ Headline: "Almost there." + italic serif "Just a few details." (#E8FF4D)
  ├─ Body copy
  └─ 3-step progress tracker (Sign in ✓ | Complete profile ● | Start browsing ○)

Right column (#fff):
  └─ Profile setup eyebrow · form title · fields:
     First name / Last name (grid) | Phone (+91 prefix) |
     Telegram @ (optional) | Pincode (auto-resolves city/state via /api/pincode/[code])
     → Continue button
```

Pincode flow: 6-digit input → debounced fetch to `/api/pincode/[code]` (Nominatim, cached 24h)
→ green chip shows "City, State" on success. Both `pincode` and `city` submitted to PATCH.

### Bug fixed (session 2)

`PATCH /api/users/me` was failing with "Cannot coerce the result to a single JSON object"
because new users have no `public.users` row — the table has no `handle_new_user` trigger
(phone is NOT NULL so a trigger-based approach is not viable at signup time).

Fix: PATCH now uses `upsert` via admin client (identity still verified with user-scoped client
first). The admin client bypasses RLS; the upsert succeeds for both new and existing rows.

Migration `supabase/migrations/008_handle_new_user.sql` adds the `users_insert_own` RLS policy
(already applied to production DB via `/pg/query`).

---

## ListingForm — 6-step Wizard (session 2)

Full visual rewrite. All logic, state, API calls, and validation unchanged.

### Shell structure
```
listing-header  (sticky top:60, z:40)  — "New listing" + autosave status + Cancel
steps-bar       (sticky top:112, z:39) — 6 horizontal steps with ✓ / ● / ○ dots
body            (grid 1fr 320px)       — main content + sidebar
  sidebar       (sticky top:164, align-self:start) — progress list + per-step tips box
footer-bar      (sticky bottom:0, z:40) — "Step N of 6 — Label" + ← Back + Continue →
```

### Per-step content
- **Step 0** — 4-col category grid, sharp-corner cards, black bg + white text when selected, inline SVG icons for all 8 types, accent ✓ tick on selected card
- **Step 1** — Catalogue search with dropdown, Brand + Model inputs, "Listing as" confirmation chip
- **Step 2** — 5 grade cards (S/A/B/C/D — all five grades retained, mockup had D omitted by mistake), each card uses its semantic color (blue/green/amber/orange/red); condition checklist below selected grade
- **Step 3** — Flush inclusion rows separated by 1px gaps
- **Step 4** — 4-slot photo grid (4:3 aspect ratio), dashed upload placeholder, resolution enforcement
- **Step 5** — Price oracle panel + asking price input + payout calculation + negotiation toggle + floor/auto-accept private fields

### Grade clarification
Mockup showed only S, A, B, C. Internal spec (ENGINEERING.md) defines S through D (5 grades). D retained in code. Grade colors use light-theme semantic values from globals.css.

---

## Validation (session 3 — 2026-06-02)

Lifecycle runbook scenarios A–H executed against `ui.audiobaaz.com` (Dokploy deployment).
All pass. Full results: `docs/reviews/lifecycle-validation-results.md`.

Issues found and fixed during validation:
- `webhook_events` table missing from deployed Supabase — applied via pg-meta DDL
- Auth callback + webhook-replay using `req.nextUrl.origin` (resolves to `localhost:3000`
  behind Cloudflare reverse proxy) — fixed to use `NEXT_PUBLIC_APP_URL` first
- `ENABLE_DEV_ROUTES=true` guard added to dev routes so they work on production-mode
  Dokploy deployments
- `hashed_token` added to `/api/dev/sign-in` response for server-side auth exchange
- `/api/dev/approve-listing` endpoint added for validation test setup

**Gate closed. Branch is ready to merge `feature/ui-redesign → dev`.**

## Next Steps (post-merge)

1. Apply light theme to remaining pages: listing detail, checkout, orders
2. Mobile responsive breakpoints (hero stacks vertically, 2-col grids stack below 768px)
3. Replace mock ticker items with real listing data
4. Add `/admin` link to nav for admin users
5. ListingForm: mobile layout (sidebar collapses to top progress bar on narrow screens)
