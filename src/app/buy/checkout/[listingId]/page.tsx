import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatPrice } from '@/lib/utils/formatting';
import { CheckoutForm } from './CheckoutForm';

interface Props {
  params: { listingId: string };
}

export default async function CheckoutPage({ params }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/buy/checkout/${params.listingId}`);

  const admin = createAdminClient();

  const [{ data: listing }, { data: profile }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('listings')
      .select('id, product_name, brand, condition_grade, asking_price, photos, status, seller_id')
      .eq('id', params.listingId)
      .single(),
    supabase.from('users').select('full_name, phone, city').eq('id', user.id).single(),
  ]);

  if (!listing || listing.status !== 'approved') notFound();
  if (listing.seller_id === user.id) redirect(`/listing/${params.listingId}`);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link
        href={`/listing/${params.listingId}`}
        className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to listing
      </Link>

      <h1 className="mb-6 font-heading text-2xl font-bold text-foreground">Checkout</h1>

      {/* Listing mini-card */}
      <div className="mb-6 flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2">
          {listing.photos?.[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.photos[0]} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{listing.brand} {listing.product_name}</p>
          <p className="text-xs text-muted-foreground">Grade {listing.condition_grade}</p>
        </div>
        <span className="font-mono text-sm font-semibold text-accent shrink-0">
          {formatPrice(listing.asking_price)}
        </span>
      </div>

      <CheckoutForm
        listingId={listing.id}
        productName={`${listing.brand} ${listing.product_name}`}
        askingPrice={listing.asking_price}
        defaultName={profile?.full_name ?? ''}
        defaultPhone={profile?.phone ?? ''}
        defaultCity={profile?.city ?? ''}
      />
    </div>
  );
}
