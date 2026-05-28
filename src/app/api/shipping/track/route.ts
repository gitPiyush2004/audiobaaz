import { createClient } from '@/lib/supabase/server';
import { shiprocket } from '@/lib/shiprocket/client';
import { type ShiprocketTrackingResponse } from '@/lib/shiprocket/helpers';
import { NextRequest, NextResponse } from 'next/server';

function ok<T>(data: T) {
  return NextResponse.json({ data, error: null });
}
function err(message: string, code: string, status = 400) {
  return NextResponse.json({ data: null, error: { message, code } }, { status });
}

export async function GET(req: NextRequest) {
  const supabase  = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err('Unauthorized', 'UNAUTHORIZED', 401);

  const order_id = req.nextUrl.searchParams.get('order_id');
  if (!order_id) return err('Missing param: order_id', 'MISSING_PARAM');

  const { data: order } = await supabase
    .from('orders')
    .select('id, buyer_id, seller_id, shiprocket_shipment_id, tracking_number, courier_name, status')
    .eq('id', order_id)
    .single();

  if (!order) return err('Order not found', 'NOT_FOUND', 404);

  // Only buyer or seller may track
  if (order.buyer_id !== user.id && order.seller_id !== user.id) {
    return err('Forbidden', 'FORBIDDEN', 403);
  }

  if (!order.shiprocket_shipment_id) {
    return err('Shipment not yet created for this order', 'NOT_SHIPPED');
  }

  const res = await shiprocket(`/courier/track/shipment/${order.shiprocket_shipment_id}`);

  if (!res.ok) {
    const text = await res.text();
    return err(`Shiprocket error: ${text}`, 'SHIPROCKET_ERROR', 502);
  }

  const raw = await res.json() as ShiprocketTrackingResponse;

  const trackData = raw.tracking_data?.shipment_track?.[0];

  return ok({
    order_id:       order.id,
    order_status:   order.status,
    tracking_number: order.tracking_number ?? null,
    courier_name:   order.courier_name    ?? null,
    current_status: trackData?.current_status  ?? null,
    delivered_date: trackData?.delivered_date  ?? null,
  });
}
