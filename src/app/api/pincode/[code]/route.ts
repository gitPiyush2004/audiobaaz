import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } },
) {
  if (!/^\d{6}$/.test(params.code)) {
    return NextResponse.json({ error: 'Invalid pincode' }, { status: 400 });
  }

  try {
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${params.code}&countrycodes=in&format=json&addressdetails=1&limit=1`,
      {
        headers: { 'User-Agent': 'Audiobaaz/1.0 (audiobaaz.com)' },
        next: { revalidate: 86400 }, // cache 24h — pincodes don't change
      },
    );
    const data = await res.json();
    const addr = data?.[0]?.address;

    if (!addr) return NextResponse.json({ city: null, state: null });

    return NextResponse.json({
      city:  addr.county ?? addr.state_district ?? addr.city ?? null,
      state: addr.state ?? null,
    });
  } catch {
    return NextResponse.json({ city: null, state: null });
  }
}
