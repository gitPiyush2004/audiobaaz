import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getShippingProvider } from '@/lib/shipping/factory';

/**
 * GET /api/shipping/track?awb=...
 *
 * Returns the latest tracking snapshot for a shipment. Buyer +
 * seller of the order may both call this; admins can call this for
 * any shipment.
 *
 * Returns:
 *   {
 *     awb, status, location, lastUpdatedAt, estimatedDelivery,
 *     history: [{ status, occurredAt, description, location }]
 *   }
 */

function ok<T>(data: T) {
  return NextResponse.json({ data, error: null });
}
function err(message: string, code: string, status = 400) {
  return NextResponse.json({ data: null, error: { message, code } }, { status });
}

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err('Unauthorized', 'UNAUTHORIZED', 401);

  const awb = req.nextUrl.searchParams.get('awb');
  if (!awb) return err('Missing awb', 'MISSING_FIELD');

  // Authz: caller must be the buyer or seller of the order this AWB
  // belongs to. (Admin role check can be added when admin RLS lands.)
  const { data: shipment } = await admin
    .from('shipments')
    .select('order_id, orders!inner(buyer_id, seller_id)')
    .eq('awb', awb)
    .maybeSingle();

  if (!shipment) return err('Shipment not found', 'NOT_FOUND', 404);

  const order = shipment.orders as unknown as { buyer_id: string; seller_id: string };
  if (order.buyer_id !== user.id && order.seller_id !== user.id) {
    return err('Forbidden', 'FORBIDDEN', 403);
  }

  const provider = getShippingProvider();
  const tracking = await provider.getTracking(awb);
  if (!tracking) return err('Tracking not available', 'NOT_FOUND', 404);

  return ok(tracking);
}
