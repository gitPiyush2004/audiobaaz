# UI Redesign — Context File
**Branch:** feature/ui-redesign
**Last updated:** 2026-05-30

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
src/app/globals.css          Light theme tokens, sharp-corner rule, abw-* CSS
src/app/layout.tsx           Instrument Serif added, DM Sans kept as fallback
src/app/page.tsx             Full homepage redesign (see Homepage Structure below)
src/components/layout/Nav.tsx            60px, full-bleed 40px, vinyl logo
src/components/layout/ProfileMenu.tsx   Avatar updated for light bg (#0a0a0a)
src/components/listing/ListingCard.tsx  Newspaper grid style, sharp corners
tailwind.config.ts           serif font family added (var(--font-serif))
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

## Next Steps (if this direction is approved)

1. Apply light theme to all other pages: browse, listing detail, checkout, dashboard, admin
2. Update seller dashboard typography and card styles to match light theme
3. Listing cards on browse page — currently uses old dark-theme card
4. Mobile responsive breakpoints (hero stacks vertically, 2-col grid below 768px)
5. Replace mock ticker items with real listing data
6. Add `/admin` link to nav for admin users (same as dark theme implementation)
