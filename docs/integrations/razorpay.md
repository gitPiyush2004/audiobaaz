# Razorpay Integration — Audiobaaz

---
title: Razorpay API Documentation
heading: API Reference Guide
description: Get started with Razorpay APIs and test them on Postman. Generate API Keys in Test and Live Modes.
---

# API Reference Guide

Razorpay APIs are completely RESTful, and all our responses are returned in JSON.

**INFO**

**Integrations**

- Looking to integrate your website, ecommerce store or mobile app with Razorpay Payment Gateway? Find the [right integration method](https://razorpay.com/docs/build/llm-docs/payments/payment-gateway.md#integration-types).
- Accept payments [**without** a website or app](https://razorpay.com/docs/build/llm-docs/payments.md#accept-payments) using other Razorpay products, such as Payment Links, Payment Pages, Subscription Links, Invoices and Smart Collect.
- For S2S integration, contact the [Support team](https://razorpay.com/support/#request) with your requirements.

  

   Our APIs are present on the Razorpay [Postman Public Workspace](https://www.postman.com/razorpaydev/workspace/razorpay-public-workspace/collection/12492020-952c7295-118c-400f-8f2c-5266ef6f689a). Watch the video to know how to fork APIs and save them to your private workspace for testing.
   

  
   Test Razorpay APIs using Postman. Watch the video to know how to get started. 
   
   All Razorpay APIs are authenticated using Basic Authentication. You must [generate test API keys](https://razorpay.com/docs/build/llm-docs/api/authentication.md) on the Dashboard before trying the APIs.
   

## API Gateway URL

For most of the Razorpay APIs, the Gateway URL is `https://api.razorpay.com/v1`. You need to include this before each API endpoint to make API calls. However, certain APIs are on V2. Hence, the gateway URL may differ for certain APIs.

    
### Example

            

            - Use the URL `https://api.razorpay.com/v1/payments` to access payment resources.

            - Use the URL `https://api.razorpay.com/v2/accounts` to access Route (Linked Account)-related resources.

            

            
        

### Related Information

- [Understand Razorpay APIs](https://razorpay.com/docs/build/llm-docs/api/understand.md)
- [API Authentication](https://razorpay.com/docs/build/llm-docs/api/authentication.md)
- [Sandbox Setup](https://razorpay.com/docs/build/llm-docs/api/sandbox-setup.md)
- [Errors](https://razorpay.com/docs/build/llm-docs/errors.md)
- [API Best Practices](https://razorpay.com/docs/build/llm-docs/api/best-practices.md)
- [API Glossary](https://razorpay.com/docs/build/llm-docs/api/glossary.md)


## Purpose

Razorpay handles:

- Buyer payment collection
- Escrow holding period
- Refunds
- Webhook notifications
- Payout trigger after successful delivery

---

## Environment Variables

```env
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```

---

## Test Mode

Use Razorpay Test Mode until production launch.

Test Dashboard:
https://dashboard.razorpay.com

API Base URL:

https://api.razorpay.com/v1

Authentication:

Basic Auth

username = KEY_ID
password = KEY_SECRET

---

## Audiobaaz Payment Flow

Buyer clicks:

Pay Now

↓

Backend creates Razorpay Order

↓

Razorpay Checkout opens

↓

Buyer pays

↓

Razorpay Webhook

payment.captured

↓

Offer Status

PAID

↓

Seller ships item

↓

Delivery confirmed

↓

Admin triggers payout

↓

Seller receives funds

---

## Database Mapping

Offer Status:

PENDING
ACCEPTED
PAID
SHIPPED
DELIVERED
COMPLETED
CANCELLED
EXPIRED

Razorpay Order:

razorpay_order_id

stored on offers table

Razorpay Payment:

razorpay_payment_id

stored on offers table

---

## Required APIs

Create Order

POST /orders

Fetch Payment

GET /payments/{id}

Refund Payment

POST /payments/{id}/refund

---

## Required Webhooks

payment.authorized

payment.captured

payment.failed

refund.processed

---

## Notes

Never trust frontend payment success.

Always verify:

- webhook signature
- payment signature

before marking offer as PAID.

---

## Future

When Razorpay Escrow/X is approved:

Replace manual payout flow with platform escrow release.