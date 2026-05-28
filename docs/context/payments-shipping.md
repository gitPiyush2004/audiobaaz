# Payments & Shipping — Context File
**Owner:** Person 4
**Branch:** feature/payments-shipping
**Last updated:** [date]

---

## What This Feature Does

Handles all money movement and logistics. Razorpay payment creation and
verification, escrow management, Shiprocket shipment creation and tracking,
webhook handlers for both services, and payout triggers.

---

## Current Status

```
[ ] Not started
```

---

## Files To Create

```
src/lib/razorpay/client.ts                      # Razorpay instance
src/lib/razorpay/helpers.ts                     # Signature verification
src/lib/shiprocket/client.ts                    # Shiprocket API client
src/lib/shiprocket/helpers.ts                   # Label generation
src/lib/telegram/bot.ts                         # Send message helpers
src/app/api/payments/create/route.ts            # Create Razorpay order
src/app/api/payments/verify/route.ts            # Verify payment
src/app/api/payments/webhook/route.ts           # Razorpay webhooks
src/app/api/shipping/create-shipment/route.ts   # Create Shiprocket shipment
src/app/api/shipping/track/route.ts             # Track shipment
src/app/api/notifications/telegram/route.ts     # Send Telegram message
```

---

## Database Tables This Feature Uses

| Table | Operation | Notes |
|-------|-----------|-------|
| payments | INSERT, UPDATE | All Razorpay records |
| orders | UPDATE | Status changes, tracking info |
| users | SELECT | Seller UPI for payout |
| notifications | INSERT | Log all sent messages |

---

## Critical Rules For This Feature

- ALL amounts in PAISE. Never use floats. ₹10,000 = 1000000
- Always verify Razorpay webhook signature before processing
- Never expose Razorpay secret key or Shiprocket password to client
- Use test keys for V1 — prefix all test Razorpay IDs with 'rzp_test_'
- Escrow = funds captured by Razorpay but not yet paid out to seller

---

## Key Business Logic

### Payment flow
1. Buyer hits checkout → POST /api/payments/create
2. Creates Razorpay order → returns order_id to client
3. Client opens Razorpay modal with order_id
4. Buyer pays → Razorpay calls POST /api/payments/webhook
5. Webhook verifies signature → updates payment status = 'captured'
6. Updates order status = 'escrow_held'
7. Notifies seller via Telegram

### Razorpay order creation
```typescript
// Amount must be in paise
const order = await razorpay.orders.create({
  amount: paidPrice,        // in paise
  currency: 'INR',
  receipt: orderId,
  notes: { listing_id, buyer_id, seller_id }
})
```

### Payment verification
```typescript
// Verify webhook/callback signature
const isValid = validateWebhookSignature(
  webhookBody,
  webhookSignature,
  process.env.RAZORPAY_KEY_SECRET
)
```

### Shiprocket integration
- Auth: email + password → get JWT token → use in all requests
- Token expires: re-authenticate if 401 received
- Create shipment after order status = 'escrow_held'
- Generate label → store shiprocket_order_id and tracking_number
- Webhook: update order status when courier scans package

### Telegram bot
```typescript
// Send message to a user
async function sendTelegram(chatId: string, message: string) {
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
  })
}
```

### Notification triggers (send Telegram when)
- Listing approved → notify seller
- Order placed → notify seller
- Payment captured → notify buyer (escrow confirmation)
- Seller ships → notify buyer (tracking number)
- Delivered → notify buyer (48hr window starts)
- 24hr inspection reminder → notify buyer
- Escrow released → notify seller (payout incoming)
- Dispute raised → notify admin
- Dispute resolved → notify buyer and seller
- Offer received → notify seller
- Offer accepted → notify buyer

---

## Next Session Starts Here

Initialize this file when starting. First task:
Set up Razorpay client at src/lib/razorpay/client.ts.
Use test keys from .env.local.
Then build POST /api/payments/create/route.ts.
It should: verify auth, validate listing is available,
create Razorpay order, create order record in DB with status 'payment_pending',
return { razorpay_order_id, amount, currency } to client.

---

## Decisions Made In This Feature

- Escrow in V1 = Razorpay payment captured, payout triggered manually by admin
- Shiprocket for all shipping — single courier integration in V1
- Telegram bot is the only notification channel in V1
- Webhook signature must be verified before any DB updates
- Payout triggered manually by admin in V1 (automated in V2)