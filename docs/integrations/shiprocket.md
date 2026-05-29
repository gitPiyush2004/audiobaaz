# Shiprocket Integration — Audiobaaz

## Purpose

Shiprocket handles:

- Shipping label generation
- Courier assignment
- Tracking updates
- Pickup scheduling
- Delivery confirmation

---

## Environment Variables

```env
SHIPROCKET_EMAIL=
SHIPROCKET_PASSWORD=
SHIPROCKET_WEBHOOK_SECRET=
```

---

## Authentication

Base URL:

https://apiv2.shiprocket.in

Authentication:

Bearer Token

Generate token via login endpoint.

Store token server-side only.

---

## Audiobaaz Shipping Flow

Seller accepts offer

↓

Buyer pays

↓

Admin verifies payment

↓

Create Shiprocket Order

↓

Generate AWB

↓

Schedule Pickup

↓

Seller ships item

↓

Tracking updates arrive via webhook

↓

Order delivered

↓

Funds released

---

## Required APIs

Authentication

Generate Token

Order Creation

Create Order

Courier Assignment

Assign AWB

Pickup Scheduling

Request Pickup

Tracking

Track Shipment

Label Generation

Generate Label PDF

Cancellation

Cancel Shipment

---

## Webhooks

Tracking Updates

Important statuses:

AWB Assigned

Pickup Scheduled

Picked Up

In Transit

Out For Delivery

Delivered

RTO

Lost

Damaged

---

## Database Mapping

Store:

shiprocket_order_id

awb_number

courier_name

tracking_status

tracking_url

---

## Audiobaaz Escrow Logic

Delivery confirmation does NOT automatically release funds.

Delivery

↓

Escrow Review Window

↓

Buyer can raise dispute

↓

No dispute

↓

Release payout

---

## Future

Possible automation:

DELIVERED

↓

wait 48 hours

↓

auto-release payout

unless dispute exists

 can see your Shiprocket API collection has 92 requests organized across 27 folders. Here's how documentation works in Postman and what I can do to help you:

How API Documentation Works in Postman
Postman generates documentation directly from your collection. You can enrich it by adding Markdown descriptions to:

The collection itself (overview, auth instructions, base URL, etc.)
Individual folders (group-level context)
Individual requests (what the endpoint does, parameters, expected responses)
Once descriptions are added, you can publish the documentation as a public URL that anyone can access.

What I can do for your Shiprocket API collection
Here are the most impactful things to get started:

Add a collection-level description — an overview of the Shiprocket API, authentication method, base URL, and how to get started.
Add folder-level descriptions — short summaries for each folder (e.g., Orders, Tracking, Couriers, etc.).
Add request-level descriptions — explain what each endpoint does, its parameters, and what it returns.
Add example responses — so readers can see what a successful (or failed) response looks like.
Your collection currently has no descriptions on any requests or folders, so there's a lot of room to improve. I can start by adding descriptions to the collection and its folders, then work through the requests.

Would you like me to get started?

how to add into my mcp server
Here's how to add an MCP server in Postman:

Option 1: Add via an AI Request (Tools Tab)
Open or create a new AI request in Postman.
Go to the Tools tab inside the request.
Click the Add Server icon.
Enter the server details:
STDIO server — enter the command, e.g. npx -y @modelcontextprotocol/server-name
Streamable HTTP server — enter the server URL
Optionally give the server a name.
Add any required environment variables (STDIO) or headers (HTTP), such as an API key.
Click Add Server.
The server will appear under MCP Servers and is enabled by default. You can toggle individual tools on/off from there.

Option 2: Add via an MCP Request → Agent Mode
Open or create an MCP request.
In the right sidebar, click Generate Config.
Choose Agent Mode.
Click Add to Agent Mode.
Postman will automatically connect that MCP server to Agent Mode.

Managing MCP Servers in Agent Mode
Go to Settings → AI to view and manage all MCP servers connected to Agent Mode, toggle them on/off, and configure tool auto-run behavior.

What you'll need before adding:

For STDIO: the run command + any required environment variables/API keys
For HTTP: the server URL + any required headers (e.g., Authorization)
can you give me copy for ai stuff in md files
Could you clarify what you mean? Are you asking for:

Markdown documentation copy to add to your Shiprocket API collection (descriptions for requests/folders) that you can copy and use?
Markdown files exported from your collection that you can save locally?
Something else entirely?
1
Let me pull the full details of your collection to generate accurate Markdown documentation copy for all the folders and requests.

I now have everything I need. Let me generate the full Markdown documentation copy for your collection.

Here is the Markdown copy for your Shiprocket API collection. You can paste each section directly into Postman's description fields.

Collection Description
Authorization: Bearer <your_token>

Folder Descriptions
Authentication API

Create Or Update Order

Return & Exchange Orders

Shipments

Couriers

Tracking

Labels | Manifests | Invoice

NDR

Products

Inventory

Listings

Channels

Pickup Addresses

Account

Statement Details

Discrepancy Details

File Imports

Wrapper API

International

Hyperlocal

Countries

Request Descriptions
Generate Token

Token Logout

Get all Orders

Get Specific Order Details

Create Channel Specific Order

Create Custom Order

Update Order

Cancel an Order

Import Orders in Bulk

Export your orders

Update Customer Delivery Address

Change/Update Pickup Location of Created Orders

Map Unmapped Products

Add Inventory for Ordered Product

Forward

Return

can you do something similart to howw razropay does it - ? "--- title: Razorpay API Documentation heading: API Reference Guide description: Get started with Razorpay APIs and test them on Postman. Generate API Keys in Test and Live Modes. --- # API Reference Guide Razorpay APIs are completely RESTful, and all our responses are returned in JSON. **INFO** **Integrations** - Looking to integrate your website, ecommerce store or mobile app with Razorpay Payment Gateway? Find the [right integration method](https://razorpay.com/docs/build/llm-docs/payments/payment-gateway.md#integration-types). - Accept payments [**without** a website or app](https://razorpay.com/docs/build/llm-docs/payments.md#accept-payments) using other Razorpay products, such as Payment Links, Payment Pages, Subscription Links, Invoices and Smart Collect. - For S2S integration, contact the [Support team](https://razorpay.com/support/#request) with your requirements. Our APIs are present on the Razorpay [Postman Public Workspace](https://www.postman.com/razorpaydev/workspace/razorpay-public-workspace/collection/12492020-952c7295-118c-400f-8f2c-5266ef6f689a). Watch the video to know how to fork APIs and save them to your private workspace for testing. Test Razorpay APIs using Postman. Watch the video to know how to get started. All Razorpay APIs are authenticated using Basic Authentication. You must [generate test API keys](https://razorpay.com/docs/build/llm-docs/api/authentication.md) on the Dashboard before trying the APIs. ## API Gateway URL For most of the Razorpay APIs, the Gateway URL is `https://api.razorpay.com/v1`. You need to include this before each API endpoint to make API calls. However, certain APIs are on V2. Hence, the gateway URL may differ for certain APIs. ### Example - Use the URL `https://api.razorpay.com/v1/payments` to access payment resources. - Use the URL `https://api.razorpay.com/v2/accounts` to access Route (Linked Account)-related resources. ### Related Information - [Understand Razorpay APIs](https://razorpay.com/docs/build/llm-docs/api/understand.md) - [API Authentication](https://razorpay.com/docs/build/llm-docs/api/authentication.md) - [Sandbox Setup](https://razorpay.com/docs/build/llm-docs/api/sandbox-setup.md) - [Errors](https://razorpay.com/docs/build/llm-docs/errors.md) - [API Best Practices](https://razorpay.com/docs/build/llm-docs/api/best-practices.md) - [API Glossary](https://razorpay.com/docs/build/llm-docs/api/glossary.md) "
Generate collection-level Markdown description
Generate folder-level Markdown descriptions
Generate request-level Markdown descriptions
Got it — you want a polished, Razorpay-style API reference for Shiprocket. Here's a complete Markdown copy you can paste into your collection's description field, structured the same way Razorpay does it.

Collection-Level Description (Razorpay-style)
Authorization: Bearer <your_token>

Per-Folder Descriptions (Razorpay-style)
Each folder description follows the same pattern: a short heading, an intro line, what the folder lets you do, and a related-info block.

Request-Level Description Template (Razorpay-style)
Razorpay's per-endpoint pages share a common shape. Use this template for every request — I've filled out a few representative ones, then provided the template at the end so you can apply the same shape across all 92 requests.

Authentication API → Generate Token
Orders → Get All Orders
Couriers → Generate AWB for Shipment
Tracking → Get Tracking through AWB
Reusable Per-Request Template
For the remaining requests, paste this template into each request's description and fill in the four parameter / body sections. Since all 92 requests follow the same RESTful pattern, the structure will stay consistent across the collection.
 can see your Shiprocket API collection has 92 requests organized across 27 folders. Here's how documentation works in Postman and what I can do to help you:

How API Documentation Works in Postman
Postman generates documentation directly from your collection. You can enrich it by adding Markdown descriptions to:

The collection itself (overview, auth instructions, base URL, etc.)
Individual folders (group-level context)
Individual requests (what the endpoint does, parameters, expected responses)
Once descriptions are added, you can publish the documentation as a public URL that anyone can access.

What I can do for your Shiprocket API collection
Here are the most impactful things to get started:

Add a collection-level description — an overview of the Shiprocket API, authentication method, base URL, and how to get started.
Add folder-level descriptions — short summaries for each folder (e.g., Orders, Tracking, Couriers, etc.).
Add request-level descriptions — explain what each endpoint does, its parameters, and what it returns.
Add example responses — so readers can see what a successful (or failed) response looks like.
Your collection currently has no descriptions on any requests or folders, so there's a lot of room to improve. I can start by adding descriptions to the collection and its folders, then work through the requests.

Would you like me to get started?

how to add into my mcp server
Here's how to add an MCP server in Postman:

Option 1: Add via an AI Request (Tools Tab)
Open or create a new AI request in Postman.
Go to the Tools tab inside the request.
Click the Add Server icon.
Enter the server details:
STDIO server — enter the command, e.g. npx -y @modelcontextprotocol/server-name
Streamable HTTP server — enter the server URL
Optionally give the server a name.
Add any required environment variables (STDIO) or headers (HTTP), such as an API key.
Click Add Server.
The server will appear under MCP Servers and is enabled by default. You can toggle individual tools on/off from there.

Option 2: Add via an MCP Request → Agent Mode
Open or create an MCP request.
In the right sidebar, click Generate Config.
Choose Agent Mode.
Click Add to Agent Mode.
Postman will automatically connect that MCP server to Agent Mode.

Managing MCP Servers in Agent Mode
Go to Settings → AI to view and manage all MCP servers connected to Agent Mode, toggle them on/off, and configure tool auto-run behavior.

What you'll need before adding:

For STDIO: the run command + any required environment variables/API keys
For HTTP: the server URL + any required headers (e.g., Authorization)
can you give me copy for ai stuff in md files
Could you clarify what you mean? Are you asking for:

Markdown documentation copy to add to your Shiprocket API collection (descriptions for requests/folders) that you can copy and use?
Markdown files exported from your collection that you can save locally?
Something else entirely?
1
Let me pull the full details of your collection to generate accurate Markdown documentation copy for all the folders and requests.

I now have everything I need. Let me generate the full Markdown documentation copy for your collection.

Here is the Markdown copy for your Shiprocket API collection. You can paste each section directly into Postman's description fields.

Collection Description
# Shiprocket API

The Shiprocket API allows you to integrate shipping, order management, and logistics capabilities into your application. Use this collection to manage orders, assign couriers, generate labels and manifests, track shipments, handle returns, and more.

**Base URL:** `https://apiv2.shiprocket.in/v1/external`

## Authentication

All endpoints (except login) require a Bearer token in the `Authorization` header.

1. Call the **Generate Token** endpoint under `Authentication API` with your email and password.
2. Copy the `token` from the response.
3. Add it to your requests as:
Authorization: Bearer <your_token>

> Tokens expire after 24 hours. Use the **Token Logout** endpoint to invalidate a token early.

## Environments

Use the `Production` environment included in this workspace. Set the following variables:

| Variable | Description |
|---|---|
| `base_url` | `https://apiv2.shiprocket.in/v1/external` |
| `token` | Your Bearer token from the login endpoint |
Folder Descriptions
Authentication API
Handles user authentication for the Shiprocket API. Generate a Bearer token using your credentials before calling any other endpoint. Tokens are valid for 24 hours.
Create Or Update Order


Endpoints for creating new orders and updating existing ones. Supports channel-specific orders, custom (ad-hoc) orders, bulk imports, cancellations, and address updates.
Return & Exchange Orders

Manage return and exchange workflows. Create return orders, update them, generate AWBs for return shipments, and create exchange orders.
Shipments

View and manage shipments associated with your orders. Retrieve shipment details, request pickups, cancel shipments, and generate pickups.
Couriers
Check courier serviceability for a given pincode and weight, assign AWBs to shipments, list available couriers, and request pickups.
Listings

Channels

Pickup Addresses

Account

Statement Details

Discrepancy Details

File Imports

Wrapper API

International

Hyperlocal

Countries

Request Descriptions
Generate Token

Token Logout

Get all Orders

Get Specific Order Details

Create Channel Specific Order

Create Custom Order

Update Order

Cancel an Order

Import Orders in Bulk

Export your orders

Update Customer Delivery Address

Change/Update Pickup Location of Created Orders

Map Unmapped Products

Add Inventory for Ordered Product

Forward

Return

can you do something similart to howw razropay does it - ? "--- title: Razorpay API Documentation heading: API Reference Guide description: Get started with Razorpay APIs and test them on Postman. Generate API Keys in Test and Live Modes. --- # API Reference Guide Razorpay APIs are completely RESTful, and all our responses are returned in JSON. **INFO** **Integrations** - Looking to integrate your website, ecommerce store or mobile app with Razorpay Payment Gateway? Find the [right integration method](https://razorpay.com/docs/build/llm-docs/payments/payment-gateway.md#integration-types). - Accept payments [**without** a website or app](https://razorpay.com/docs/build/llm-docs/payments.md#accept-payments) using other Razorpay products, such as Payment Links, Payment Pages, Subscription Links, Invoices and Smart Collect. - For S2S integration, contact the [Support team](https://razorpay.com/support/#request) with your requirements. Our APIs are present on the Razorpay [Postman Public Workspace](https://www.postman.com/razorpaydev/workspace/razorpay-public-workspace/collection/12492020-952c7295-118c-400f-8f2c-5266ef6f689a). Watch the video to know how to fork APIs and save them to your private workspace for testing. Test Razorpay APIs using Postman. Watch the video to know how to get started. All Razorpay APIs are authenticated using Basic Authentication. You must [generate test API keys](https://razorpay.com/docs/build/llm-docs/api/authentication.md) on the Dashboard before trying the APIs. ## API Gateway URL For most of the Razorpay APIs, the Gateway URL is `https://api.razorpay.com/v1`. You need to include this before each API endpoint to make API calls. However, certain APIs are on V2. Hence, the gateway URL may differ for certain APIs. ### Example - Use the URL `https://api.razorpay.com/v1/payments` to access payment resources. - Use the URL `https://api.razorpay.com/v2/accounts` to access Route (Linked Account)-related resources. ### Related Information - [Understand Razorpay APIs](https://razorpay.com/docs/build/llm-docs/api/understand.md) - [API Authentication](https://razorpay.com/docs/build/llm-docs/api/authentication.md) - [Sandbox Setup](https://razorpay.com/docs/build/llm-docs/api/sandbox-setup.md) - [Errors](https://razorpay.com/docs/build/llm-docs/errors.md) - [API Best Practices](https://razorpay.com/docs/build/llm-docs/api/best-practices.md) - [API Glossary](https://razorpay.com/docs/build/llm-docs/api/glossary.md) "
Got it — you want a polished, Razorpay-style API reference for Shiprocket. Here's a complete Markdown copy you can paste into your collection's description field, structured the same way Razorpay does it.

Collection-Level Description (Razorpay-style)
Authorization: Bearer <your_token>

Per-Folder Descriptions (Razorpay-style)
Each folder description follows the same pattern: a short heading, an intro line, what the folder lets you do, and a related-info block.

Request-Level Description Template (Razorpay-style)
Razorpay's per-endpoint pages share a common shape. Use this template for every request — I've filled out a few representative ones, then provided the template at the end so you can apply the same shape across all 92 requests.

Authentication API → Generate Token
Orders → Get All Orders
Couriers → Generate AWB for Shipment
Tracking → Get Tracking through AWB
Reusable Per-Request Template
For the remaining requests, paste this template into each request's description and fill in the four parameter / body sections. Since all 92 requests follow the same RESTful pattern, the structure will stay consistent across the collection.

A note on accuracy: I drafted the request bodies and parameters above based on Shiprocket's standard REST patterns. Before publishing, you'll want to validate field names (especially required fields and nested objects) against the live Shiprocket developer portal so the docs match the API exactly.

make it into a huge one chunk of copy paste output
Here's the full documentation as one big copy-paste block. Paste sections into the corresponding description fields in Postman.

https://apiv2.shiprocket.in/v1/external

POST /auth/login

The response contains a token valid for 240 hours (10 days). Store it securely and refresh before expiry.

Using the Token
Add the following header to every authenticated request:

Environment Variables
This collection uses the following variables. Configure them in the Production environment.

Variable	Description	Example
base_url	Shiprocket API gateway base URL	https://apiv2.shiprocket.in/v1/external
token	Bearer token returned by /auth/login	eyJ0eXAiOiJKV1QiLCJhbGciOi...
email	Shiprocket account email (used to generate token)	merchant@example.com
password	Shiprocket account password	••••••••
API Gateway URLs
Environment	URL
Production	https://apiv2.shiprocket.in/v1/external
Example request:

Rate Limits
Shiprocket enforces rate limits per merchant account. If you exceed the limit, the API returns 429 Too Many Requests. Implement exponential backoff for retries.

Errors
Code	Meaning
200	Success
400	Bad Request — invalid or missing parameters
401	Unauthorized — token missing, invalid, or expired
403	Forbidden — insufficient permissions
404	Resource not found
422	Validation error
429	Rate limit exceeded
500	Internal server error
Related Information
Shiprocket Developer Portal
Shiprocket Help Center
Shiprocket Dashboard
================================================================================ FOLDER: Authentication API
title: Authentication API description: Generate a Bearer token used to authenticate all other Shiprocket API calls.
Authentication API
All Shiprocket API requests require a Bearer token. Use these endpoints to generate and manage authentication tokens.

Tokens are valid for 240 hours (10 days). Refresh proactively to avoid 401 Unauthorized responses.

Common Use Cases
Generate a token at application startup and cache it.
Refresh the token before expiry using a background job.
Re-authenticate when a request returns 401.
================================================================================ FOLDER: Create Or Update Order
title: Create Or Update Order description: Create new orders (single or bulk), update existing orders, and manage order lifecycle.
Create Or Update Order
Endpoints to create custom orders, channel-based orders, bulk imports, and update existing order details such as customer, address, and items.

Common Use Cases
Push orders from your storefront or ERP into Shiprocket.
Bulk-create orders during peak sales events.
Update buyer address before AWB generation.
Cancel orders that are no longer fulfilled.
================================================================================ FOLDER: Return & Exchange Orders
title: Return & Exchange Orders description: Create and manage reverse pickup and exchange orders.
Return & Exchange Orders
Manage the full reverse logistics lifecycle — from creating return orders to scheduling reverse pickups and exchanges.

Common Use Cases
Initiate a return on customer request.
Schedule a reverse pickup with a serviceable courier.
Convert a return into an exchange.
Track refund and exchange status.
================================================================================ FOLDER: Shipments
title: Shipments description: View, manage, and operate on shipments created from orders.
Shipments
A shipment is created when an order is assigned to a courier. Use these endpoints to list, filter, and operate on shipments.

Common Use Cases
List all shipments by status (pending, shipped, delivered, RTO).
Generate AWB for a shipment.
Schedule pickup for shipped orders.
Cancel a shipment before pickup.
================================================================================ FOLDER: Couriers
title: Couriers description: Discover serviceable couriers, check rates, and assign couriers to shipments.
Couriers
Look up serviceable couriers for a pincode pair, compare rates, and assign the best courier per shipment.

Common Use Cases
Check serviceability before checkout.
Compare courier rates by weight and dimensions.
Auto-assign the cheapest or fastest courier.
Block or prefer specific couriers per warehouse.
================================================================================ FOLDER: Tracking
title: Tracking description: Track shipment status using AWB, Order ID, or Shipment ID.
Tracking
Get real-time tracking updates for any active shipment.

Common Use Cases
Show live tracking on customer order pages.
Trigger notifications on status change (Out for Delivery, Delivered, RTO).
Reconcile delivery status with internal systems.
================================================================================ FOLDER: Labels | Manifests | Invoice
title: Labels, Manifests & Invoices description: Generate shipping labels, manifests, and tax invoices for shipments.
Labels, Manifests & Invoices
Generate the documents required to hand over packages to courier partners.

Common Use Cases
Print shipping labels in bulk.
Generate manifests for pickup handover.
Generate GST-compliant tax invoices.
================================================================================ FOLDER: NDR (Non-Delivery Report)
title: NDR description: Manage Non-Delivery Reports — re-attempts, RTO, and buyer feedback.
NDR
When a delivery attempt fails, the courier raises an NDR. Use these endpoints to take action — re-attempt, mark RTO, or update buyer details.

Common Use Cases
List all open NDRs.
Action an NDR (re-attempt / RTO).
Capture buyer response from your support team.
================================================================================ FOLDER: Products
title: Products description: Manage your product catalog in Shiprocket.
Products
Create and maintain a product catalog mapped to Shiprocket SKUs.

Common Use Cases
Sync product catalog from your store.
Bulk update SKU dimensions and weight.
Tag HSN codes for GST compliance.
================================================================================ FOLDER: Inventory
title: Inventory description: Manage stock levels across warehouses.
Inventory
Track and update stock for each SKU across all warehouses.

Common Use Cases
Sync inventory after fulfillment.
Bulk update stock levels.
Reserve inventory for pending orders.
================================================================================ FOLDER: Listings
title: Listings description: Manage marketplace and storefront listings synced to Shiprocket.
Listings
Manage product listings imported from connected sales channels.

Common Use Cases
View all imported listings.
Map listings to internal SKUs.
Update price and availability.
================================================================================ FOLDER: Channels
title: Channels description: Manage connected sales channels (Shopify, WooCommerce, Amazon, etc.).
Channels
A channel represents an external sales platform integrated with Shiprocket.

Common Use Cases
List all connected channels.
Toggle channels on/off.
Sync orders from a channel on demand.
================================================================================ FOLDER: Pickup Addresses
title: Pickup Addresses description: Manage warehouse / pickup locations.
Pickup Addresses
Add and manage the warehouses or seller addresses from which couriers pick up shipments.

Common Use Cases
Add a new warehouse.
Set a default pickup location.
Update warehouse address or contact.
================================================================================ FOLDER: Account
title: Account description: Account, wallet, and KYC operations.
Account
Manage your Shiprocket account — wallet balance, recharge, and KYC status.

Common Use Cases
Check wallet balance before bulk shipments.
Recharge the wallet.
Verify KYC status.
================================================================================ FOLDER: Statement Details
title: Statement Details description: Download account statements and transaction history.
Statement Details
Retrieve detailed transaction statements for accounting and reconciliation.

Common Use Cases
Pull monthly statements for finance.
Reconcile freight charges against orders.
Download invoice PDFs.
================================================================================ FOLDER: Discrepancy Details
title: Discrepancy Details description: Raise and track weight or freight discrepancies.
Discrepancy Details
When the courier reports a different weight than declared, a discrepancy is raised. Use these endpoints to dispute or accept.

Common Use Cases
List open discrepancies.
Accept or dispute a discrepancy.
Upload supporting evidence.
================================================================================ FOLDER: File Imports
title: File Imports description: Bulk import orders, products, and inventory via file upload.
File Imports
Upload CSV/XLSX files to bulk-create orders, products, or inventory updates.

Common Use Cases
Bulk-create orders during sale events.
Upload product catalog from ERP.
Import inventory snapshot.
================================================================================ FOLDER: Wrapper API
title: Wrapper API description: High-level convenience endpoints that bundle multiple operations.
Wrapper API
Aggregated endpoints that combine multiple steps (create order + assign courier + generate AWB) in a single call.

Common Use Cases
One-click order fulfillment.
Reduce round-trips for storefront integrations.
================================================================================ FOLDER: International
title: International description: Cross-border shipping operations.
International
Endpoints specific to cross-border shipments — customs declarations, HS codes, and international rate calculation.

Common Use Cases
Calculate international shipping rates.
Generate commercial invoices.
Manage customs documentation.
================================================================================ FOLDER: Hyperlocal
title: Hyperlocal description: Same-city, same-day delivery operations.
Hyperlocal
Endpoints for hyperlocal (intra-city) shipments using last-mile partners.

Common Use Cases
Check hyperlocal serviceability.
Book a same-day delivery.
Track hyperlocal rider in real time.
================================================================================ FOLDER: Countries
title: Countries description: Reference data for supported countries and states.
Countries
Reference data endpoints for country and state codes used across the platform.

Common Use Cases
Populate country / state dropdowns.
Validate addresses before order creation.
================================================================================ REQUEST: Generate Token (POST /auth/login)
title: Generate Token method: POST endpoint: /auth/login auth: None (this endpoint generates the token)
Generate Token
Generates a Bearer token used to authenticate all subsequent API calls. The returned token is valid for 240 hours (10 days).

Endpoint
Request Body
Field	Type	Required	Description
email	string	Yes	Shiprocket account email
password	string	Yes	Shiprocket account password
{
    "email": "mer
Response
Response Fields
Field	Type	Description
id	integer	Internal user ID
first_name	string	First name on the account
last_name	string	Last name on the account
email	string	Account email
company_id	integer	Associated company ID
token	string	Bearer token for authenticating requests
Related Information
Save the returned token to your environment variable named token.
Token expires after 240 hours — refresh proactively.
================================================================================ REQUEST: Get All Orders (GET /orders)
title: Get All Orders method: GET endpoint: /orders auth: Bearer Token
Get All Orders
Retrieves a paginated list of all orders associated with your Shiprocket account.

Endpoint
Query Parameters
Parameter	Type	Required	Description
per_page	integer	No	Number of records per page (default 10, max 50)
page	integer	No	Page number (default 1)
sort	string	No	ASC or DESC by created date
sort_by	string	No	Field to sort by (e.g., created_at)
to	string	No	End date filter (YYYY-MM-DD)
from	string	No	Start date filter (YYYY-MM-DD)
filter	string	No	Filter by status (e.g., delivered, cancelled)
filter_by	string	No	Field to filter on
search	string	No	Free-text search across order ID, AWB, customer name
Response
Related Information
Use from and to filters to limit large result sets.
Combine filter=delivered with date filters to reconcile completed orders.
================================================================================ REQUEST: Generate AWB for Shipment (POST /courier/assign/awb)
title: Generate AWB for Shipment method: POST endpoint: /courier/assign/awb auth: Bearer Token
Generate AWB for Shipment
Assigns a courier and generates an Air Waybill (AWB) for an existing shipment.

Endpoint
Request Body
Field	Type	Required	Description
shipment_id	integer	Yes	The shipment ID returned at order creation
courier_id	integer	No	Specific courier to assign (omit for auto-assign)
status	string	No	reassign to change a previously assigned courier
Response
Related Information
Call Check Courier Serviceability first to find the cheapest serviceable courier.
After AWB generation, call Generate Pickup to schedule courier pickup.
Generate the shipping label via Generate Label.
================================================================================ REQUEST: Get Tracking through AWB (GET /courier/track/awb/:awb)
title: Get Tracking through AWB method: GET endpoint: /courier/track/awb/:awb auth: Bearer Token
Get Tracking through AWB
Returns the latest tracking status and full scan history for a shipment, looked up by AWB number.

Endpoint
Path Parameters
Parameter	Type	Required	Description
awb	string	Yes	The AWB number issued by courier
Response
Related Information
For active shipments, poll every 4–6 hours rather than continuously.
Use webhooks (configured in the Shiprocket dashboard) for push-based status updates.
================================================================================ TEMPLATE: Reusable Per-Request Description (apply to remaining requests)
title: method: <GET | POST | PUT | PATCH | DELETE> endpoint: auth: Bearer Token
Endpoint
Path Parameters
Parameter	Type	Required	Description
Query Parameters
Parameter	Type	Required	Description
Request Body
Field	Type	Required	Description
Response
Related Information
<Edge cases, rate-limit notes, retry guidance>
================================================================================

================================================================================ HOW TO ADD AN MCP SERVER IN POSTMAN
Option A — From an AI Request (Tools tab)

Open or create an AI Request in Postman.
Go to the Tools tab → click "+" or "Add Server".
Choose STDIO (local command) or HTTP (remote URL).
STDIO: enter the command (e.g., npx -y @modelcontextprotocol/server-github) and any environment variables.
HTTP: enter the server URL and any required headers.
Click "Add Server". Available tools appear and can be toggled per request.
Option B — From an MCP Request

Create a new MCP Request.
Configure the server (STDIO command or HTTP URL).
Click "Generate Config" → "Agent Mode" → "Add to Agent Mode".
The server is now available to Postman's Agent Mode.
Manage connected servers under: Settings → AI → MCP Servers.
