import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
      { status: 401 },
    );
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json(
      { data: null, error: { message: 'No file provided', code: 'NO_FILE' } },
      { status: 400 },
    );
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const admin = createAdminClient();
  const buffer = await file.arrayBuffer();

  const { error } = await admin.storage
    .from('listings')
    .upload(path, buffer, { contentType: file.type || 'image/jpeg', upsert: false });

  if (error) {
    return NextResponse.json(
      { data: null, error: { message: error.message, code: 'UPLOAD_FAILED' } },
      { status: 500 },
    );
  }

  const { data: { publicUrl } } = admin.storage.from('listings').getPublicUrl(path);

  return NextResponse.json({ data: { url: publicUrl }, error: null });
}
