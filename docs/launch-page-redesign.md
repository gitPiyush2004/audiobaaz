# Launch Page

**File:** `audiobaaz_launch.html` (source) → `public/launch.html` (deployed)
**Status:** SHIPPED — live on main, waitlist form active
**Last updated:** 2026-06-04

> The launch page is a standalone HTML file, NOT a Next.js route.
> `src/app/launch/` was removed — do not recreate it.
> To update: edit `audiobaaz_launch.html`, then copy to `public/launch.html`.
> Production Supabase (`supabase.audiobaaz.com`) has `waitlist_emails` table.
> Root redirect (`/` → `/launch.html`) lives in `next.config.mjs` — remove when full app ships.

---

## Animation specs (for future iteration reference)

---

## Context

The launch page is a standalone pre-launch announcement page going to `main` (production). It is not part of the dev app — it has its own CSS module, its own layout that suppresses the app nav/footer, and its own font stack. Changes here do not affect the rest of the codebase.

The page is structurally sound. The bones, copy, and layout are correct. What needs to change is the hero visual, the motion layer, and a set of specific patterns that read as AI-generated scaffolding.

---

## Typography — keep, with restraint

**Decision: keep Instrument Serif italic. Change how often it appears.**

The font is already committed identity across the whole ui-redesign branch. The problem is not the font — it is that the italic serif emphasis appears in every single major heading on the page:
- Hero h1: "audio obsessives."
- How it works: "start to payout."
- Bento: "protection at the core."
- Community: "before we launch."
- Notify: "when we launch."

Five italic serif moments across eight sections = every section has the same rhythmic cadence. This is what reads as templated, not the font itself.

**Rule: maximum two italic serif moments on the entire page.**

Keep:
1. Hero h1: "audio obsessives." — this is the brand moment, it earns it
2. Notify section: "when we launch." — the conversion section earns a second

Remove from:
- How it works heading → plain weight contrast instead
- Bento heading → plain weight contrast instead
- Community heading → plain weight contrast instead

Body font (Helvetica Neue) and prices/codes (JetBrains Mono) — no changes.

---

## What stays exactly as-is

- All copy. Every word. Do not touch the manifesto, the how-it-works descriptions, the bento copy.
- The 2-column hero split (left text / right dark panel)
- Sharp corners everywhere — correct for this brand
- The dark notify section at the bottom
- The ticker concept
- The `AUDIO[BAAZ]` footer wordmark with accent highlight
- The Logo component in the nav
- Mobile CSS breakpoints already written (they are correct)
- The scroll reveal pattern (`.reveal` + `IntersectionObserver`) — it works, keep it

---

## Section-by-section changes

---

### 1. Hero — right panel: holographic vinyl

**Current state:** concentric ring SVG at 5% opacity, `slowSpin 80s` — essentially invisible background texture.

**Problem:** The vinyl record is the brand's physical symbol. It is being used as faint decoration.

**New behaviour:**

The vinyl record becomes the dominant visual in the right panel. The rings get a conic-gradient layer that creates an iridescent sheen on the grooves.

**Desktop (pointer device only — gate with `@media (hover: hover) and (pointer: fine)`):**
- Base: a slow ambient conic-gradient hue-rotation cycling over 12s (`@keyframes holoSpin`)
- On mouse enter: the gradient reacts to cursor position via CSS custom properties `--mx` and `--my` set by a `mousemove` listener (same pattern as the existing bento spotlight code already in the file)
- The iridescent shimmer tracks the pointer — the record surface shifts through amber → teal → violet as the angle changes
- The rings opacity increases to 0.18 (from 0.05) when the panel is hovered

**Mobile (touch device):**
- The ambient hue-rotation runs at a slower pace (20s cycle)
- No interaction needed. The record still looks alive.
- No mousemove listener fires on touch devices

**Implementation notes:**
- The SVG `vinylBg` stays as-is for the groove structure
- Add a new sibling element `vinylHolo` — a circle of the same size, `position: absolute`, `background: conic-gradient(...)`, `mix-blend-mode: screen`, `opacity: 0.15`
- The `holoSpin` keyframe animates `filter: hue-rotate(0deg)` → `filter: hue-rotate(360deg)` — GPU-only, no layout
- `@media (prefers-reduced-motion: reduce)` — remove hue-rotation, keep static gradient at 0.1 opacity

---

### 2. Hero — right panel: tonearm

**Current state:** no tonearm.

**New element:** an SVG tonearm/needle arm that rests at the edge of the record.

**Behaviour:**
- On page load, after a 1400ms delay (after the hero right panel has slid in), the tonearm rotates from "resting" position to "playing" position — a 0.8s ease-out rotation
- Once playing: a very subtle waveform pulse (3-4 bars, CSS animation) appears below the `.featName` text, representing audio output
- The tonearm SVG is simple: a thin line with a small circle at the needle end, rotated via CSS transform-origin at the pivot point
- `@media (prefers-reduced-motion: reduce)` — tonearm appears in playing position immediately, no rotation, no waveform

**Why this matters:** it ties the featured listing to the act of playing. The record is active, not just displayed.

---

### 3. Hero — right panel: scanner line

**Current state:** none.

**New element:** a single horizontal line that slowly sweeps across the vinyl panel.

**Implementation:**
```css
@keyframes scanSweep {
  0%   { transform: translateY(0); opacity: 0; }
  5%   { opacity: 0.4; }
  95%  { opacity: 0.4; }
  100% { transform: translateY(100%); opacity: 0; }
}
```
- Position: `absolute`, `width: 100%`, `height: 1px`, `background: linear-gradient(to right, transparent, rgba(232,255,77,0.6), transparent)`
- Duration: 6s, linear, infinite
- Pure CSS — no JavaScript
- `@media (prefers-reduced-motion: reduce)` — remove entirely

---

### 4. Hero — left panel: remove proof stat bar

**Current state:** three stats in a row — `10% / 48hr / 100%` — with dividers between them.

**Problem:** This is verbatim the "hero-metric template" banned pattern (big number, small label, three equal stats). It reads as SaaS landing page, not earned credibility.

**Replacement:** Remove the `.heroProof` block entirely. The proof lives in the subtext copy, which already says "Every listing condition-graded. Every transaction escrow-protected." That is more credible than a stat bar.

The space this frees up in the hero left column can either:
- Breathe (generous padding between subtext and CTAs is fine)
- Or carry a single specific claim: the number of signups if we have them at launch time (e.g. "412 people waiting") — one number, not three

**Decision:** Remove the stat bar. Replace with a single line in smaller text below the CTAs: `"Join X audiophiles on the waitlist"` — initially hardcoded, can be made dynamic later.

---

### 5. How it works — sticky stack on desktop

**Current state:** 5 numbered rows in a ruled 3-column grid. The 01–05 numbers are the AI scaffolding tell.

**Changes:**

**Remove:** the `.hrNum` column with the large grey numbers. They are section numbering as scaffolding, not useful sequencing information.

**Desktop (≥768px) — GSAP sticky-stack:**
- Each of the 5 steps becomes a full-viewport-height card
- GSAP ScrollTrigger: each card pins at `top: 0` when it reaches the viewport top
- Previous card scales to 0.95 and opacity drops to 0.55 as the next card arrives from below
- `pinSpacing: false` so the cards stack without gaps
- The card interior uses the existing content (title, tag, description) plus a small right-side visual (different per step — see below)

**Per-step visuals (right side of each card):**
1. Create listing — the listing form step indicator (3 circles: Product, Condition, Photos)
2. We verify it — condition grade badges S / A / B / C in their semantic colors
3. Buyer pays — a simple SVG escrow lock (closes on card enter)
4. Ship the gear — a minimal shipment timeline (3 dots: Created → Shipped → Delivered)
5. Get paid — UPI logo mark + ₹ symbol, or just the 10% figure at display size

**Mobile (< 768px):**
- Abandon sticky-stack entirely. iOS momentum scroll fights `position: sticky` sequences.
- Use the existing `.reveal` + IntersectionObserver pattern already on the page
- Each step is a full-width stacked card with `data-reveal` — they slide up on scroll
- No GSAP on mobile for this section

**`@media (prefers-reduced-motion: reduce)`:** skip the stack animation, show all cards visible simultaneously

---

### 6. Bento — remove numbered eyebrows, add visual variation

**Current state:** cells have `01` through `05` as tiny uppercase labels — section numbering reflex applied to individual cells.

**Changes:**

**Remove:** all `.bcN` number labels (01, 02, 03, 04, 05).

**Visual variation — need at least 3 cells with real visual content, not white-on-white text:**

Cell 1 — Escrow (dark, tall):
- Keep: `100%` large stat in accent color
- Add: a simple animated SVG lock that "closes" via `clip-path` or `stroke-dashoffset` when the section enters the viewport
- The lock animates once, on scroll entry, `@media (hover: hover)` for the CSS stroke animation

Cell 2 — Condition grading (yellow):
- Remove: plain text "S, A, B, C. Consistent."
- Add: the 5 grade badges (S / A / B / C / D) as small pills in their semantic colors (from ENGINEERING.md: S=#E8FF4D, A=#4DFF91, B=#4D9FFF, C=#FFB84D, D=#FF4D4D), displayed as a row inside the yellow cell
- The contrast issue: these neon colors on yellow background need checking. Use dark text on each pill, dark pill bg — e.g. S gets dark bg with accent border, not the accent bg itself

Cell 3 — Dispute support (white):
- Add: a minimal SVG scale/balance mark as a decorative element, light grey, `position: absolute` bottom-right
- Keep the existing copy

Cell 4 — Telegram (off-white):
- Remove: plain text description
- Add: 2-3 Telegram-style notification rows (not a div-fake — just styled text rows that look like notification previews)
  - "Offer accepted — ₹68,000 for Audeze LCD-2"
  - "Shipment picked up — AWB #1234567890"
  - "Escrow released — ₹61,200 credited"
- These are real-looking but clearly illustrative

Cell 5 — Zero listing fee (wide, white):
- Keep exactly as-is. The `10%` display number + "Only when sold" is the best cell on the page.

---

### 7. Community cards — hold-to-activate

**Current state:** plain anchor tags. Click and the link opens.

**Problem:** a misclick opens WhatsApp/Telegram immediately. For mobile this is even more likely.

**New interaction (Emil clip-path hold-to-activate pattern):**

```
On mousedown / touchstart:
  clip-path: inset(0 100% 0 0) → inset(0 0% 0 0) over 2s linear
  (the .ccBar at top of card fills from left to right as a progress indicator)

On mouseup / touchend before 2s:
  clip-path snaps back: inset(0 0% 0 0) → inset(0 100% 0 0) over 200ms ease-out

On hold completion (2s elapsed):
  the "Join now" / "Subscribe" CTA text blurs: filter: blur(4px), opacity: 0.5 over 150ms
  then resolves to "Opening..." over 150ms
  then the link fires via window.open()
```

The `.ccBar` becomes the hold progress indicator — it already has the correct color for WA/TG and the `transition: width` animation. Replace `width` animation with `clip-path` animation instead (clip-path is GPU-composited, width is not).

`@media (prefers-reduced-motion: reduce)`: remove the hold requirement. Single tap/click fires the link immediately. The animation is the only affordance for the delay — without motion, the delay is inaccessible.

---

### 8. Notify submit — morphing button

**Current state:** flat accent button, `opacity: 0.4` when disabled. No in-progress state.

**New states:**

**Idle:** current appearance — accent bg, black text "Notify me at launch"

**Loading (after click, before response):**
- Button content blurs: `filter: blur(3px)` over 120ms
- A clip-path progress bar fills the button face from left: `clip-path: inset(0 100% 0 0)` → `inset(0 0 0 0)` over 1.2s linear (simulating an API call duration)
- The progress layer background: slightly darker shade of accent (`#d0e832`)

**Success:**
- Progress fill completes
- Button content cross-fades (blur out old label, blur in "You're on the list ✓")
- The blur transition masks the text swap — Emil's "blur to mask imperfect transitions" principle
- Button stays in success state, no reversal

**Error (invalid email):**
- Button does not enter loading state
- Input border transitions to `--error: #FF4D4D`
- The `.notifyNote` text below slides up 8px and changes color — same `translateY + opacity` pattern already used elsewhere on the page

**Touch target:** ensure the button is `min-height: 52px` — currently 15px padding × 2 + font = ~39px. Needs the min-height floor for mobile.

---

### 9. Ticker — magnetic spring (desktop only)

**Current state:** pure CSS `tickL 30s linear infinite`. Correct base.

**Desktop addition:**
- Wrap the ticker in a Motion `motion.div` client component
- `useMotionValue` for a `springOffset` that represents how much the ticker is pulled toward the cursor
- On `mousemove` over the ticker area: update `springOffset` target based on `(mouseX - tickerCenterX) * 0.08`
- `useSpring(springOffset, { stiffness: 80, damping: 20 })` — gives it momentum
- Apply the spring value as an additional `translateX` on the track, composited on top of the CSS animation
- Individual pills: `useTransform` to apply a subtle `translateY` of ±4px based on proximity

**Mobile:** the CSS animation runs as-is. The Motion component renders but no mousemove handler fires. No performance cost.

**Implementation note:** the existing CSS animation and the Motion `translateX` can coexist if the CSS animation runs on the track element and the Motion value runs on a wrapper. They do not conflict.

---

## Patterns being removed (never add back)

| Pattern | Location | Why |
|---|---|---|
| `.hrNum` (01–05 numbers) | How it works rows | Numbered scaffolding tell |
| `.bcN` number labels (01–05) | Bento cells | Same |
| `.heroProof` stat bar | Hero left | Hero-metric template |
| Italic serif emphasis in every section heading | Bento, how-it-works, community | Repetition makes it feel templated |
| `transition: all` anywhere | Check globals.css | Emil: specify exact properties |

---

## Patterns being added

| Pattern | Location | Source |
|---|---|---|
| Holographic conic-gradient vinyl | Hero right | CSS `conic-gradient` + `hue-rotate` |
| Tonearm SVG animation | Hero right | CSS `rotate` + `transform-origin` |
| Scanner sweep line | Hero right | Pure CSS `@keyframes` |
| GSAP sticky-stack | How it works (desktop) | design-taste Section 5.A skeleton |
| Hold-to-activate clip-path | Community cards | Emil clip-path pattern |
| Morphing submit button | Notify section | Emil blur + clip-path |
| Ticker magnetic spring | Ticker (desktop) | Emil `useSpring` mouse tracking |
| Animated SVG lock | Bento cell 1 | `stroke-dashoffset` on scroll enter |
| Grade badge pills | Bento cell 2 | Static HTML |
| Telegram notification rows | Bento cell 4 | Styled text rows |

---

## New dependencies needed

| Package | Why | Already installed? |
|---|---|---|
| `gsap` + `gsap/ScrollTrigger` | How-it-works sticky-stack (desktop only) | Check `package.json` |
| `motion/react` (or `framer-motion`) | Ticker spring, hold-to-activate | Check `package.json` |

Both should already be in the project given the existing `useSpring`-style code. Verify before implementing.

---

## Mobile-specific rules (non-negotiable)

- How-it-works sticky-stack: **disabled on mobile**. Use scroll-reveal stagger only.
- Holographic vinyl: ambient animation only on mobile, no mousemove listener
- Ticker spring: CSS animation only on mobile, no Motion listener
- Hold-to-activate: `touchstart`/`touchend` events, same logic as mousedown/mouseup
- Notify button: `min-height: 52px` for touch target compliance
- All cursor effects gated behind `@media (hover: hover) and (pointer: fine)`
- `@media (prefers-reduced-motion: reduce)` blocks for every animation added

---

## Files to change

| File | Changes |
|---|---|
| `src/app/launch/page.tsx` | All JSX changes — new components, removed blocks, new event handlers |
| `src/app/launch/launch.module.css` | Holographic vinyl CSS, scanner keyframe, updated hover states, remove stat bar styles |
| `src/app/launch/layout.tsx` | No changes expected |

New components to extract (keep them in `src/app/launch/` — not shared app components):
- `HoloVinyl.tsx` — the vinyl + tonearm + scanner, `'use client'`
- `HowItWorksStack.tsx` — GSAP sticky-stack, `'use client'`, desktop-only with mobile fallback
- `TickerMagnetic.tsx` — Motion spring ticker, `'use client'`
- `CommunityCard.tsx` — hold-to-activate card, `'use client'`
- `NotifyForm.tsx` — morphing submit with actual POST /api/notify, `'use client'`

---

## API route still needed

`POST /api/notify` — save email to Supabase. This is separate from the visual redesign but must ship before the page goes to `main`. Needs a `waitlist_emails` table or similar in the production DB.

---

## Animation system (Emil brainstorm — 2026-06-03)

### Cohesion rule

All animations share one brand curve. Zero bounce anywhere. Deliberate, not snappy. Define these in `launch.module.css` once:

```css
.page {
  --ease:        cubic-bezier(0.23, 1, 0.32, 1);  /* brand ease-out — use everywhere */
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1); /* for on-screen movement */
  --ease-linear: linear;                           /* constant motion only */

  /* Duration vocabulary — pick from this list, never invent */
  --dur-instant:    160ms;   /* button press feedback */
  --dur-fast:       250ms;   /* small UI, dropdowns */
  --dur-standard:   400ms;   /* nav, modals */
  --dur-marketing:  700ms;   /* hero reveals, section entrances */
  --dur-deliberate: 900ms;   /* tonearm, physical objects */
  --dur-ambient:    7000ms;  /* scanner sweep */
  --dur-hold:       2000ms;  /* hold-to-activate */
}
```

---

### Existing bugs to fix before adding anything new

| Before | After | Why |
|---|---|---|
| No `:active` scale on any button | `transform: scale(0.97)` on `:active` for `.btnPrimary`, `.btnOutline`, `.btnNav`, `.notifySubmit` | Emil: every pressable element must give press feedback |
| `.howRow:hover { background }` with no transition | Add `transition: background-color 200ms ease` | Missing transition = jarring instant jump |
| `.ccBar { transition: width 0.5s }` animated on hover | Replace with `clip-path` animated on hold via JS (see below) | `width` is not GPU composited; hover is the wrong trigger |
| Nav slide `transition: transform 0.6s` | `transition: transform 300ms var(--ease)` | Nav is UI, not marketing. 600ms feels broken |
| `.btnNav:hover { background: #222 }` no transition | Add `transition: background-color 150ms ease` | Missing transition |

---

### Animation specs per component

#### Holographic vinyl (ambient)
- **Layer 1 — ambient:** CSS `@keyframes holoSpin { from { filter: hue-rotate(0deg) } to { filter: hue-rotate(360deg) } }`, duration `14s`, easing `linear`, infinite. Off main thread.
- **Layer 2 — cursor reactive:** CSS vars `--mx`/`--my` set by mousemove → conic-gradient angle. Gated behind `@media (hover: hover) and (pointer: fine)`.
- **Mobile:** Layer 1 only. No mousemove.
- **Reduced motion:** Remove Layer 1. Set static gradient at `opacity: 0.08`.

#### Tonearm
- **Easing:** `var(--ease)` (cubic-bezier(0.23, 1, 0.32, 1)) — settling like a physical arm.
- **Duration:** `var(--dur-deliberate)` (900ms).
- **Transform-origin:** `90% 10%` (pivot at top-right of arm SVG).
- **Resting:** `rotate(-28deg)`. Playing: `rotate(-8deg)`.
- **Trigger:** CSS class toggle via `setTimeout(1400)` after page load.
- **Implementation:** CSS transition + class toggle. No Motion needed.
- **Waveform bars after touchdown:** 3 bars, `@keyframes wavePulse`, `transform: scaleY(0.4)` → `scaleY(1)`, 2s cycle, `transform-origin: bottom`, stagger 80ms between bars.
- **Reduced motion:** No rotation. Tonearm appears in playing position immediately. Waveform static.

#### Scanner sweep line
- **Easing:** `linear` for sweep movement (constant motion). `ease` for opacity fade at start/end — baked into the keyframe.
- **Duration:** `var(--dur-ambient)` (7s). Delay `2.2s` (after tonearm touches down).
- **Tilt:** `rotate(-2deg)` matching tonearm angle. Not purely horizontal.
- **Reduced motion:** `display: none`.

#### Scroll reveals — break the uniform reflex
Four variants instead of one:

```css
[data-reveal]              /* default */  opacity+translateY(24px), 700ms
[data-reveal="manifesto"]  /* large type */ opacity+translateY(16px)+scale(0.98), 900ms
[data-reveal="from-left"]  /* how-it-works heading */ opacity+translateX(-20px), 600ms
[data-reveal="fade"]       /* stats, numbers */ opacity only, 600ms
```

All use `var(--ease)`. Add the specific `data-reveal` value to the relevant section's wrapper element.

#### GSAP sticky-stack (how-it-works)
- **Outgoing card:** `scale: 0.92, opacity: 0.65` (not 0.55 — test on mobile, 0.55 is too light).
- **Scrub:** `scrub: true` (proportional to scroll, no fixed duration).
- **Per-card visual entrance:** WAAPI, not Motion — triggered by GSAP scroll position. `duration: 500, easing: 'cubic-bezier(0.23, 1, 0.32, 1)'`. Enter from `opacity:0, translateY(12px), scale(0.97)`.
- **Mobile:** Replaced entirely with `[data-reveal]` stagger. No GSAP.
- **Reduced motion:** All cards visible simultaneously, no scroll pinning.

#### Hold-to-activate community cards

Replace `.ccBar` entirely:

```css
/* New .ccBar */
.ccBar {
  height: 3px;
  width: 100%;
  clip-path: inset(0 100% 0 0);    /* hidden by default */
  transition: clip-path 200ms var(--ease);  /* release: fast */
}
.ccBar.holding {
  clip-path: inset(0 0% 0 0);
  transition: clip-path 2000ms linear;      /* press: deliberate */
}
```

JS: `mousedown`/`mouseup` + `touchstart`/`touchend`. On mousedown: add `.holding`, start 2s `setTimeout`. On mouseup: remove `.holding` (snaps back 200ms), clear timeout. On completion: blur CTA text → swap text → remove blur.

```css
.ccCtaText { transition: filter 150ms ease, opacity 150ms ease; }
.ccCtaText.completing { filter: blur(3px); opacity: 0; }
```

**Reduced motion:** Remove hold requirement. Single click fires link immediately.

#### Notify submit morphing

```css
/* Add to .notifySubmit */
.notifySubmit:active:not(:disabled) {
  transform: scale(0.97);  /* missing press feedback */
}

/* Progress fill via clip-path, not width */
.notifySubmit::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.12);
  clip-path: inset(0 100% 0 0);
  transition: clip-path 1000ms linear;
}
.notifySubmit.loading::after { clip-path: inset(0 0% 0 0); }

/* Text morph */
.notifySubmitLabel { transition: filter 180ms ease, opacity 180ms ease; }
.notifySubmitLabel.morphing { filter: blur(4px); opacity: 0; }
```

Sequence: click → `.loading` (fill starts) → 1000ms → `.morphing` on label → 180ms → swap text → remove `.morphing`.

#### Ticker magnetic spring
- **Spring config:** `{ stiffness: 60, damping: 25, mass: 0.5 }` — gentle, no oscillation.
- **Max offset:** ±20px. Subtle whisper, not a shout.
- **Implementation:** `useMotionValue` + `useSpring` on a wrapper `motion.div`. CSS `@keyframes tickL` stays on the inner `.tickerTrack`. Two elements, no conflict.
- **NOT `useState`** — re-renders on every mousemove frame.
- **Mobile:** CSS animation only. No Motion events.

---

## Implementation order

1. Typography restraint — remove italic serif from 3 of the 5 heading uses. 10 minutes, highest signal-to-noise.
2. Remove proof stat bar from hero. 5 minutes.
3. Remove bento and how-it-works numbered eyebrows. 5 minutes.
4. `HoloVinyl.tsx` — the vinyl holographic effect + tonearm + scanner. Highest visual impact, isolated component.
5. `HowItWorksStack.tsx` — GSAP sticky-stack with mobile fallback. Most complex.
6. Bento visual variation — grade badges, Telegram rows, lock animation.
7. `CommunityCard.tsx` — hold-to-activate.
8. `NotifyForm.tsx` — morphing submit + POST /api/notify.
9. `TickerMagnetic.tsx` — spring ticker. Last because lowest priority.
10. Full mobile pass — verify every section on a real device or emulator.
