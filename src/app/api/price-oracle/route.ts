import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

function ok<T>(data: T) {
  return NextResponse.json({ data, error: null });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const model = (searchParams.get('model') ?? '').trim();
  if (!model) return ok([]);

  const supabase = createClient();
  const { data } = await supabase
    .from('price_history')
    .select('sold_price, sold_at, condition_grade')
    .ilike('product_name', `%${model}%`)
    .order('sold_at', { ascending: false })
    .limit(10);

  return ok(data ?? []);
}
