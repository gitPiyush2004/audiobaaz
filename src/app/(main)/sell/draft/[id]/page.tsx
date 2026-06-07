import { createClient } from '@/lib/supabase/server';
import { ListingForm, type ListingFormInitialData } from '@/components/forms/ListingForm';
import { redirect, notFound } from 'next/navigation';

export const metadata = { title: 'Edit Draft — Audiobaaz' };

export default async function DraftPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: listing } = await supabase
    .from('listings')
    .select('id, seller_id, status, brand, product_name, category, condition_grade, inclusions, photos, asking_price, is_negotiable')
    .eq('id', params.id)
    .single();

  if (!listing)                     notFound();
  if (listing.seller_id !== user.id) redirect('/dashboard/listings?tab=draft');
  if (listing.status !== 'draft')    redirect('/dashboard/listings');

  const initialData: ListingFormInitialData = {
    productTypeId:     listing.category,
    productBrand:      listing.brand,
    productName:       listing.product_name,
    grade:             listing.condition_grade,
    inclusions:        (listing.inclusions as Record<string, boolean>) ?? {},
    existingPhotoUrls: (listing.photos as string[]) ?? [],
    askingPricePaise:  listing.asking_price,
    negotiationEnabled: listing.is_negotiable ?? false,
  };

  return <ListingForm draftId={listing.id} initialData={initialData} />;
}
