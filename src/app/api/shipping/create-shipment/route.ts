import { createClient } from '@/lib/supabase/server';
import { shiprocket } from '@/lib/shiprocket/client';
import { buildShiprocketPayload, type ShiprocketOrderResponse } from '@/lib/shiprocket/helpers';
import { sendTelegramMessage } from '@/lib/telegram';
import { NextRequest, NextResponse } from 'next/server';

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

  const { order_id } = await req.json() as { order_id?: string };
  if (!order_id) return err('Missing field: order_id', 'MISSING_FIELD');

  // Fetch order with listing details
  const { data: order } = await supabase
    .from('orders')
    .select(`
      id, seller_id, buyer_id, listing_id, paid_price, status,
      delivery_name, delivery_phone, delivery_line1,
      delivery_city, delivery_pincode, delivery_state,
      shiprocket_order_id
    `)
    .eq('id', order_id)
    .single();

  if (!order)                         return err('Order not found', 'NOT_FOUND', 404);
  if (order.seller_id !== user.id)    return err('Forbidden', 'FORBIDDEN', 403);
  if (order.status !== 'escrow_held') return err('Shipment can only be created once payment is held in escrow', 'INVALID_STATE');

  // Idempotent — already created
  if (order.shiprocket_order_id) {
    return ok({ shiprocket_order_id: order.shiprocket_order_id });
  }

  // Fetch listing for product name
  const { data: listing } = await supabase
    .from('listings')
    .select('product_name, brand')
    .eq('id', order.listing_id)
    .single();

  if (!listing) return err('Listing not found', 'NOT_FOUND', 404);

  const pickupLocation = process.env.SHIPROCKET_PICKUP_LOCATION;
  if (!pickupLocation) return err('SHIPROCKET_PICKUP_LOCATION is not configured', 'CONFIG_ERROR', 500);

  const payload = buildShiprocketPayload({
    orderId:         order.id,
    productName:     listing.product_name,
    brand:           listing.brand,
    paidPricePaise:  order.paid_price,
    deliveryName:    order.delivery_name,
    deliveryPhone:   order.delivery_phone,
    deliveryLine1:   order.delivery_line1,
    deliveryCity:    order.delivery_city,
    deliveryPincode: order.delivery_pincode,
    deliveryState:   order.delivery_state,
    pickupLocation,
  });

  // Create shipment on Shiprocket
  const res = await shiprocket('/orders/create/adhoc', {
    method: 'POST',
    body:   JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    return err(`Shiprocket error: ${text}`, 'SHIPROCKET_ERROR', 502);
  }

  const srOrder = await res.json() as ShiprocketOrderResponse;

  // Persist Shiprocket IDs + update order status
  const { error: updateErr } = await supabase
    .from('orders')
    .update({
      status:                  'seller_confirmed',
      shiprocket_order_id:     String(srOrder.order_id),
      shiprocket_shipment_id:  String(srOrder.shipment_id),
      tracking_number:         srOrder.awb_code      ?? null,
      courier_name:            srOrder.courier_name  ?? null,
    })
    .eq('id', order.id);

  if (updateErr) return err(updateErr.message, updateErr.code ?? 'DB_ERROR', 500);

  // Notify buyer
  const { data: buyer } = await supabase
    .from('users')
    .select('telegram_chat_id')
    .eq('id', order.buyer_id)
    .single();

  if (buyer?.telegram_chat_id) {
    const trackLine = srOrder.awb_code
      ? `\nTracking number: <code>${srOrder.awb_code}</code>${srOrder.courier_name ? ` (${srOrder.courier_name})` : ''}`
      : '';
    await sendTelegramMessage(
      buyer.telegram_chat_id,
      `<b>Your order has been shipped ✓</b>\n\n<b>${listing.brand} ${listing.product_name}</b> is on its way.${trackLine}\n\nYou have 48 hours from delivery to inspect the item.`,
    );
  }

  return ok({
    shiprocket_order_id:    String(srOrder.order_id),
    shiprocket_shipment_id: String(srOrder.shipment_id),
    tracking_number:        srOrder.awb_code     ?? null,
    courier_name:           srOrder.courier_name ?? null,
  });
}
