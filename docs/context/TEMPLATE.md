# [Feature Name] — Context File
**Owner:** [Your name]
**Tool:** AI coding tool
**Branch:** feature/[branch-name]
**Last updated:** [date]

> Copy this template when starting a new feature.
> Update at the end of every session — this is your memory.

---

## What This Feature Does

[One paragraph explaining what this feature is and what problem it solves
for the user. Be specific — not "handles seller flow" but "lets a seller
create a listing from scratch including photos, condition grading, pricing,
and negotiation settings, with draft auto-save at every step."]

---

## Current Status

```
[ ] Not started
[ ] In progress
[ ] Complete
[ ] Blocked — reason: [why]
```

---

## Files Created

List every file this feature owns:

```
src/app/(main)/sell/page.tsx
src/app/(main)/sell/new/page.tsx
src/components/forms/PhotoUpload.tsx
src/app/api/listings/route.ts
```

---

## Database Operations

Which tables does this feature read/write:

| Table | Operation | Notes |
|-------|-----------|-------|
| listings | INSERT, UPDATE | Draft auto-save on each step |
| products | SELECT | Product search |
| users | SELECT | Seller profile check |

---

## API Routes Owned

Routes this feature created — available for other features to use:

| Method | Route | What it does |
|--------|-------|-------------|
| POST | /api/listings | Create new listing (draft) |
| PATCH | /api/listings/[id] | Update listing / change status |
| GET | /api/listings/[id] | Get single listing |

---

## What's Working

- [ ] [Feature 1] — describe briefly
- [ ] [Feature 2]
- [ ] [Feature 3]

---

## What's In Progress

- [ ] [What you're currently building]
- [ ] [What's next after that]

---

## Known Issues / Bugs

- [Issue 1] — describe the bug and where it happens
- [Issue 2]

---

## Next Session Starts Here

[Exact description of where to pick up. Be specific enough that
a fresh AI coding tool session with no memory can continue without asking.
Example: "The listing intake form has 6 steps. Steps 1-4 are complete.
Step 5 is the photo upload — the UI is done but the Supabase storage
upload function in /src/lib/supabase/storage.ts is not yet connected
to the form. Start there."]

---

## Decisions Made In This Feature

Things decided while building — so future sessions don't revisit them:

- [Decision 1 and why]
- [Decision 2 and why]

---

## Dependencies On Other Features

What this feature needs from other people's work:

| Needs | From | Status |
|-------|------|--------|
| GET /api/listings | Person 2 buyer flow | Complete |
| users table | Database schema | Complete |

---

## What Other Features Can Use From Here

What you've built that other people's features depend on:

| What | How to use |
|------|-----------|
| POST /api/listings | Send listing object — see types/listing.ts for shape |
| ListingCard component | Import from components/listing/ListingCard.tsx |