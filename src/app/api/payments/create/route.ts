import { createClient } from '@/lib/supabase/server';
import { razorpay } from '@/lib/razorpay/client';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Fixed shipping fee for V1 — make dynamic via Shiprocket quotes in V2
const SHIPPING_FEE_PAISE = 15000; // ₹150
const PLATFORM_FEE_PCT   = 0.10;

function ok<T>(data: T) {
  return NextResponse.json({ data, error: null });
}
function err(message: string, code: string, status = 400) {
  return NextResponse.json({ data: null, error: { message, code } }, { status });
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err('Unauthorized', 'UNAUTHORIZED', 401);

  const body = await req.json() as {
    listing_id:     string;
    offer_id?:      string;
    delivery_name:  string;
    delivery_phone: string;
    delivery_line1: string;
    delivery_line2?: string;
    delivery_city:  string;
    delivery_pincode: string;
    delivery_state: string;
  };

  // Validate required fields
  const required = [
    'listing_id', 'delivery_name', 'delivery_phone',
    'delivery_line1', 'delivery_city', 'delivery_pincode', 'delivery_state',
  ] as const;
  for (const field of required) {
    if (!body[field]) return err(`Missing field: ${field}`, 'MISSING_FIELD');
  }

  // Fetch listing
  const { data: listing } = await supabase
    .from('listings')
    .select('id, seller_id, asking_price, status, product_name, brand')
    .eq('id', body.listing_id)
    .single();

  if (!listing)                          return err('Listing not found', 'NOT_FOUND', 404);
  if (listing.status !== 'approved')     return err('Listing is not available', 'UNAVAILABLE');
  if (listing.seller_id === user.id)     return err('Cannot buy your own listing', 'FORBIDDEN');

  // Determine paid price — offer price if offer_id provided, else asking price
  let paidPrice = listing.asking_price;

  if (body.offer_id) {
    const { data: offer } = await supabase
      .from('offers')
      .select('id, status, buyer_id, listing_id, offered_price')
      .eq('id', body.offer_id)
      .single();

    if (!offer)                              return err('Offer not found', 'NOT_FOUND', 404);
    if (offer.buyer_id  !== user.id)         return err('Offer does not belong to you', 'FORBIDDEN');
    if (offer.listing_id !== body.listing_id) return err('Offer is for a different listing', 'MISMATCH');
    if (offer.status    !== 'accepted')      return err('Offer is not accepted', 'INVALID_STATE');

    paidPrice = offer.offered_price;
  }

  // Calculate fees — all in paise, no floats
  const platformFee  = Math.floor(paidPrice * PLATFORM_FEE_PCT);
  const sellerPayout = paidPrice - platformFee;
  const totalAmount  = paidPrice + SHIPPING_FEE_PAISE;

  // Generate order ID upfront so Razorpay receipt matches our DB record
  const orderId = crypto.randomUUID();

  // Create Razorpay order
  let razorpayOrder: { id: string; amount: number; currency: string };
  try {
    razorpayOrder = await razorpay.orders.create({
      amount:   totalAmount,
      currency: 'INR',
      receipt:  orderId,
      notes: {
        listing_id: body.listing_id,
        buyer_id:   user.id,
        seller_id:  listing.seller_id,
      },
    }) as typeof razorpayOrder;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Razorpay order creation failed';
    return err(msg, 'RAZORPAY_ERROR', 502);
  }

  // Insert order record — triggers reserve_listing() which sets listing → reserved
  const { error: orderErr } = await supabase
    .from('orders')
    .insert({
      id:               orderId,
      listing_id:       body.listing_id,
      buyer_id:         user.id,
      seller_id:        listing.seller_id,
      offer_id:         body.offer_id ?? null,
      listing_price:    listing.asking_price,
      paid_price:       paidPrice,
      platform_fee:     platformFee,
      shipping_fee:     SHIPPING_FEE_PAISE,
      seller_payout:    sellerPayout,
      delivery_name:    body.delivery_name,
      delivery_phone:   body.delivery_phone,
      delivery_line1:   body.delivery_line1,
      delivery_line2:   body.delivery_line2 ?? null,
      delivery_city:    body.delivery_city,
      delivery_pincode: body.delivery_pincode,
      delivery_state:   body.delivery_state,
      status:           'payment_pending',
    });

  if (orderErr) return err(orderErr.message, orderErr.code ?? 'DB_ERROR', 500);

  // Insert payment record
  const { error: paymentErr } = await supabase
    .from('payments')
    .insert({
      order_id:         orderId,
      razorpay_order_id: razorpayOrder.id,
      amount:           totalAmount,
      currency:         'INR',
      status:           'created',
    });

  if (paymentErr) return err(paymentErr.message, paymentErr.code ?? 'DB_ERROR', 500);

  return ok({
    order_id:          orderId,
    razorpay_order_id: razorpayOrder.id,
    amount:            totalAmount,   // paise — Razorpay modal needs this
    currency:          'INR',
    key_id:            process.env.RAZORPAY_KEY_ID, // safe to expose (public key)
  });
}
