import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getShippingProvider } from '@/lib/shipping/factory';
import { MockShippingProvider } from '@/lib/shipping/mock';
import type { ShipmentStatus } from '@/lib/shipping/provider';

/**
 * POST /api/dev/shipping/advance
 *
 * DEV-ONLY. Advances a mock shipment to the next status in its
 * lifecycle. Used by the seller dashboard's "Mark shipped" button
 * (V1 mock mode) and by validation scripts running through scenarios
 * A–E.
 *
 * Hard guards:
 *   - 404 unless the active provider is the MockShippingProvider.
 *   - Auth required; no role check (the underlying RPC validates
 *     that the caller is the order's seller for picked_up; for
 *     transitions further down the lifecycle, anyone can advance
 *     in dev mode).
 *
 * Body shape:
 *   { awb: string, to_status: ShipmentStatus }
 *
 * The provider's advanceTracking() updates the mock_shipments row;
 * the record_shipment_status_change RPC then runs the order-side
 * cascade (picked_up → orders.shipped, delivered → orders.delivered
 * + 48h inspection window).
 */

function ok<T>(data: T) {
  return NextResponse.json({ data, error: null });
}
function err(message: string, code: string, status = 400) {
  return NextResponse.json({ data: null, error: { message, code } }, { status });
}

interface AdvanceBody {
  awb: string;
  to_status: ShipmentStatus;
}

export async function POST(req: NextRequest) {
  const provider = getShippingProvider();
  if (!(provider instanceof MockShippingProvider)) {
    return err('Not found', 'NOT_FOUND', 404);
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err('Unauthorized', 'UNAUTHORIZED', 401);

  const body = (await req.json()) as AdvanceBody;
  if (!body.awb) return err('Missing awb', 'MISSING_FIELD');
  if (!body.to_status) return err('Missing to_status', 'MISSING_FIELD');

  // Update the mock provider's internal tracking state.
  let snapshot;
  try {
    snapshot = await provider.advanceTracking(body.awb, body.to_status);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'advance failed';
    return err(message, 'INVALID_TRANSITION');
  }

  // Run the order-side cascade via RPC. This is what moves orders.status
  // forward (picked_up → shipped, delivered → delivered + inspection).
  const admin = createAdminClient();
  const { data: rpcResult, error: rpcErr } = await admin.rpc('record_shipment_status_change', {
    p_awb:         body.awb,
    p_to_status:   body.to_status,
    p_description: snapshot.history[snapshot.history.length - 1]?.description ?? body.to_status,
    p_location:    snapshot.location,
    p_actor_id:    user.id,
  });

  if (rpcErr) return err(rpcErr.message, 'RPC_ERROR', 500);

  return ok({ snapshot, rpc: rpcResult });
}
