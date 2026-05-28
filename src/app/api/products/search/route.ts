import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

function ok<T>(data: T) {
  return NextResponse.json({ data, error: null });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q        = (searchParams.get('q') ?? '').trim();
  const category = searchParams.get('category');

  if (q.length < 2) return ok([]);

  const supabase = createClient();
  let query = supabase
    .from('products')
    .select('id, name, brand, model, category')
    .or(`name.ilike.%${q}%,brand.ilike.%${q}%`)
    .limit(8);

  if (category) query = query.eq('category', category);

  const { data } = await query;
  return ok(data ?? []);
}
