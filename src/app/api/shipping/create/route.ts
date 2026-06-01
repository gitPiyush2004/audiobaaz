import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getShippingProvider } from '@/lib/shipping/factory';

/**
 * POST /api/shipping/create
 *
 * Seller-initiated shipment booking. Called from the seller dashboard
 * order detail page once payment has reached escrow_held.
 *
 * Flow:
 *   1. Auth + ownership check (seller_id matches caller).
 *   2. Order must be in escrow_held (or seller_confirmed for retry).
 *   3. Look up the seller's pickup address from their profile.
 *   4. Call ShippingProvider.createShipment() — real or mock.
 *   5. Hand off to record_shipment_created RPC for atomic DB writes.
 *
 * RPC handles: shipments INSERT, shipment_events INSERT, orders.status
 * transition (escrow_held → seller_confirmed), order_events INSERT,
 * tracking_number/courier_name denormalisation.
 */

function ok<T>(data: T) {
  return NextResponse.json({ data, error: null });
}
function err(message: string, code: string, status = 400) {
  return NextResponse.json({ data: null, error: { message, code } }, { status });
}

interface CreateShipmentBody {
  order_id: string;
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const admin = createAdminClient();

  // ── Auth ─────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err('Unauthorized', 'UNAUTHORIZED', 401);

  const body = (await req.json()) as CreateShipmentBody;
  if (!body.order_id) return err('Missing order_id', 'MISSING_FIELD');

  // ── Fetch order ──────────────────────────────────────────────
  const { data: order } = await admin
    .from('orders')
    .select(
      `id, seller_id, buyer_id, status, listing_id, paid_price,
       delivery_name, delivery_phone, delivery_line1, delivery_line2,
       delivery_city, delivery_pincode, delivery_state`,
    )
    .eq('id', body.order_id)
    .single();

  if (!order) return err('Order not found', 'NOT_FOUND', 404);
  if (order.seller_id !== user.id) {
    return err('Only the seller can create a shipment for this order', 'FORBIDDEN', 403);
  }
  if (order.status !== 'escrow_held' && order.status !== 'seller_confirmed') {
    return err(`Order is not shippable (status=${order.status})`, 'NOT_SHIPPABLE');
  }

  // Reject if a shipment already exists for this order — UNIQUE on
  // shipments.order_id will reject anyway, but a friendly error here
  // is better than a DB error code surfacing.
  const { data: existing } = await admin
    .from('shipments')
    .select('id, awb')
    .eq('order_id', order.id)
    .maybeSingle();

  if (existing) {
    return err(
      'Shipment already exists for this order',
      'SHIPMENT_EXISTS',
      409,
    );
  }

  // ── Seller pickup address ────────────────────────────────────
  const { data: seller } = await admin
    .from('users')
    .select('full_name, phone, city, pincode')
    .eq('id', user.id)
    .single();

  if (!seller) return err('Seller profile not found', 'NOT_FOUND', 404);
  if (!seller.city || !seller.pincode) {
    return err(
      'Complete your profile (city + pincode) before creating a shipment',
      'INCOMPLETE_PROFILE',
    );
  }

  // ── Listing for itemName ─────────────────────────────────────
  const { data: listing } = await admin
    .from('listings')
    .select('product_name')
    .eq('id', order.listing_id)
    .single();

  // ── Call provider ────────────────────────────────────────────
  const provider = getShippingProvider();
  let shipment;
  try {
    shipment = await provider.createShipment({
      orderId:            order.id,
      pickup: {
        name:    seller.full_name ?? 'Audiobaaz Seller',
        phone:   seller.phone ?? '',
        line1:   'Pickup address on file', // V1: full pickup address comes later
        city:    seller.city,
        pincode: seller.pincode,
        state:   '', // V1: derive from pincode later
      },
      delivery: {
        name:    order.delivery_name,
        phone:   order.delivery_phone,
        line1:   order.delivery_line1,
        line2:   order.delivery_line2,
        city:    order.delivery_city,
        pincode: order.delivery_pincode,
        state:   order.delivery_state,
      },
      itemName:           listing?.product_name ?? 'Audio gear',
      declaredValuePaise: order.paid_price,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Shipping provider error';
    return err(message, 'PROVIDER_ERROR', 502);
  }

  // ── Atomic DB writes via RPC ─────────────────────────────────
  const { data: rpcResult, error: rpcErr } = await admin.rpc('record_shipment_created', {
    p_order_id:             order.id,
    p_provider:             provider.name,
    p_awb:                  shipment.awb,
    p_provider_shipment_id: shipment.providerShipmentId,
    p_provider_order_id:    shipment.providerOrderId,
    p_courier:              shipment.courier,
    p_estimated_delivery:   shipment.estimatedDelivery,
    p_declared_value_paise: order.paid_price,
    p_pickup_city:          seller.city,
    p_delivery_city:        order.delivery_city,
    p_actor_id:             user.id,
  });

  if (rpcErr) return err(rpcErr.message, 'RPC_ERROR', 500);

  return ok({
    shipment_id:        rpcResult.shipment_id,
    awb:                shipment.awb,
    courier:            shipment.courier,
    estimated_delivery: shipment.estimatedDelivery,
  });
}
