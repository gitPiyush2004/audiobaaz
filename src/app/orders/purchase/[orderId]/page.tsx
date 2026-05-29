import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatPrice } from '@/lib/utils/formatting';

interface Props {
  params: { orderId: string };
}

export default async function OrderConfirmPage({ params }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (createAdminClient() as any)
    .from('orders')
    .select('id, paid_price, platform_fee, seller_payout, status, delivery_city, delivery_state, listings(brand, product_name, condition_grade, photos)')
    .eq('id', params.orderId)
    .eq('buyer_id', user.id)
    .single();

  if (!order) notFound();

  const listing = Array.isArray(order.listings) ? order.listings[0] : order.listings;

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">

      <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-3xl">
        ✓
      </div>

      <h1 className="font-heading text-2xl font-bold text-foreground">Order confirmed!</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your payment is held in escrow. The seller will be notified to ship your item.
      </p>

      {listing && (
        <div className="mt-8 flex items-center gap-4 rounded-xl border border-border bg-surface p-4 text-left">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2">
            {listing.photos?.[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={listing.photos[0]} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground">
              {listing.brand} {listing.product_name}
            </p>
            <p className="text-xs text-muted-foreground">Grade {listing.condition_grade}</p>
            <p className="mt-1 font-mono text-sm font-semibold text-accent">
              {formatPrice(order.paid_price)}
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-border bg-surface p-4 text-left text-sm space-y-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Order ID</span>
          <span className="font-mono text-xs text-foreground">{order.id.slice(0, 8)}…</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Delivering to</span>
          <span className="text-foreground">{order.delivery_city}, {order.delivery_state}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Status</span>
          <span className="text-success font-medium">Escrow held</span>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3">
        <Link
          href="/browse"
          className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-accent text-sm font-semibold text-black transition-all hover:bg-accent-hover"
        >
          Continue browsing
        </Link>
      </div>

    </div>
  );
}
