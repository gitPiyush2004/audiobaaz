import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPaymentProvider } from '@/lib/payments/factory';
import { DevPaymentProvider } from '@/lib/payments/dev';

/**
 * POST /api/dev/payments/simulate
 *
 * DEV-ONLY. Returns a synthesised payment_id + signature pair that
 * /api/payments/verify will accept. CheckoutForm calls this in place
 * of opening the Razorpay modal when the active PaymentProvider is
 * the dev provider.
 *
 * The signature is computed by DevPaymentProvider using the same
 * dev secret the verify route uses for verification — there is no
 * "skip signature check" path. The verify route does not branch on
 * provider; it just runs the active provider's verifyPaymentSignature.
 *
 * Hard guards:
 *   - 404 unless the active provider is the dev provider.
 *     (Selection is controlled by PAYMENT_PROVIDER=dev + non-prod
 *     NODE_ENV via the factory; this route is reachable only when
 *     the factory has selected the dev provider.)
 *
 * Authentication: requires a logged-in user. We don't enforce
 * ownership of the order here because the verify route does the
 * actual cascade and is the source of truth for who's allowed to
 * verify what.
 */

function ok<T>(data: T) {
  return NextResponse.json({ data, error: null });
}
function err(message: string, code: string, status = 400) {
  return NextResponse.json({ data: null, error: { message, code } }, { status });
}

interface SimulateBody {
  razorpay_order_id: string;
}

export async function POST(req: NextRequest) {
  // Guard: only the dev provider may use this endpoint. Anything else
  // returns 404 so the route is invisible in production.
  const provider = getPaymentProvider();
  if (!(provider instanceof DevPaymentProvider)) {
    return err('Not found', 'NOT_FOUND', 404);
  }

  // Auth — require a logged-in user. The verify route enforces its
  // own auth + ownership rules; we just keep this endpoint behind
  // the auth wall so it can't be hit anonymously.
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err('Unauthorized', 'UNAUTHORIZED', 401);

  const body = (await req.json()) as SimulateBody;
  if (!body.razorpay_order_id) return err('Missing razorpay_order_id', 'MISSING_FIELD');

  const { providerPaymentId, signature } = await provider.simulatePayment(body.razorpay_order_id);

  return ok({
    razorpay_order_id:   body.razorpay_order_id,
    razorpay_payment_id: providerPaymentId,
    razorpay_signature:  signature,
  });
}
