# Admin Panel — Context File
**Owner:** Person 3
**Branch:** feature/admin-panel
**Last updated:** [date]

---

## What This Feature Does

Internal tool for the Audiobaaz team to review and approve listings,
manage disputes, monitor orders, manage users, and trigger payouts.
Accessible only to users with role = 'admin'. Lives at /admin/*.

---

## Current Status

```
[ ] Not started
```

---

## Files To Create

```
src/app/admin/layout.tsx                        # Admin layout + role check
src/app/admin/page.tsx                          # Overview dashboard
src/app/admin/listings/page.tsx                 # Review queue
src/app/admin/listings/[id]/page.tsx            # Review single listing
src/app/admin/orders/page.tsx                   # All orders
src/app/admin/disputes/page.tsx                 # Dispute queue
src/app/admin/disputes/[id]/page.tsx            # Resolve dispute
src/app/admin/users/page.tsx                    # User management
src/app/admin/payouts/page.tsx                  # Payout management
src/app/api/admin/listings/[id]/review/route.ts # Approve/reject listing
src/app/api/admin/disputes/[id]/resolve/route.ts # Resolve dispute
src/app/api/admin/payouts/[id]/trigger/route.ts  # Trigger payout
```

---

## Database Tables This Feature Uses

| Table | Operation | Notes |
|-------|-----------|-------|
| listings | SELECT, UPDATE | Review queue, approve/reject |
| listing_reviews | INSERT | Log every review action |
| orders | SELECT, UPDATE | Monitor all orders |
| disputes | SELECT, UPDATE | Review and resolve |
| users | SELECT, UPDATE | Manage accounts, scores |
| payments | SELECT | Payment status |
| notifications | INSERT | Send Telegram alerts |

---

## Key Business Logic

### Route protection
- Admin layout checks: if user.role !== 'admin' → redirect to homepage
- Use Supabase server client to verify role server-side
- Never trust client-side role checks alone

### Listing review queue
- Show all listings with status = 'pending', oldest first
- Per listing show: all photos, condition, inclusions, ownership proof
- 5-point manual checklist:
  1. Photo quality and angles complete
  2. Contact info visible in photos (phone, social, QR)
  3. Condition grade matches photos
  4. Declared inclusions visible in photos
  5. Price sanity check
- Actions: Approve → status = 'approved' | Reject → status = 'rejected'
- On approve: send Telegram to seller with listing URL
- On reject: send Telegram to seller with specific reason
- Log action in listing_reviews table

### Dispute resolution
- Show all disputes with status = 'open' or 'under_review'
- Show: buyer claim, evidence photos/video, order details
- Resolution options:
  - Full refund → refund buyer, no seller payout
  - Partial refund → specify amount in paise
  - Reject dispute → release escrow to seller
- On resolution: update dispute status, trigger appropriate payout/refund
- Update buyer_score or seller_score based on outcome

### User management
- View all users
- See seller_score and buyer_score (internal only)
- Suspend user: set is_active = false
- Add strike: increment strike_count
- Promote to admin: set role = 'admin'

### Payout management
- Show all orders with status = 'completed' and payout_status = 'pending'
- Trigger payout: send to seller UPI, update payout_status = 'paid'
- Show payout history

---

## Next Session Starts Here

Initialize this file when starting. First task:
Build the admin layout at src/app/admin/layout.tsx.
It must check if the logged-in user has role = 'admin' using
Supabase server client. If not admin, redirect to '/'.
Then build the listing review queue at src/app/admin/listings/page.tsx.

---

## Decisions Made In This Feature

- Admin panel is part of main repo — not a separate app
- Role check happens server-side in layout.tsx — not middleware alone
- Every approval/rejection logged in listing_reviews table
- Dispute resolution updates user trust scores
- Payout triggered manually by admin in V1 — automated in V2