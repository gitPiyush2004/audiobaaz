import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

type Action = 'suspend' | 'reactivate' | 'strike' | 'promote';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ data: null, error: { message: 'Forbidden', code: 'FORBIDDEN' } }, { status: 403 });
  }

  const { action } = await req.json() as { action: Action };

  if (!['suspend', 'reactivate', 'strike', 'promote'].includes(action)) {
    return NextResponse.json({ data: null, error: { message: 'Invalid action', code: 'INVALID_ACTION' } }, { status: 400 });
  }

  // Prevent self-action
  if (params.id === user.id) {
    return NextResponse.json({ data: null, error: { message: 'Cannot perform this action on your own account', code: 'SELF_ACTION' } }, { status: 400 });
  }

  const adminClient = createAdminClient();

  // Fetch current state
  const { data: target } = await adminClient
    .from('users')
    .select('id, is_active, role, strike_count')
    .eq('id', params.id)
    .single();

  if (!target) {
    return NextResponse.json({ data: null, error: { message: 'User not found', code: 'NOT_FOUND' } }, { status: 404 });
  }

  let update: Record<string, unknown> = {};

  switch (action) {
    case 'suspend':
      if (!target.is_active) {
        return NextResponse.json({ data: null, error: { message: 'User is already suspended', code: 'ALREADY_SUSPENDED' } }, { status: 400 });
      }
      update = { is_active: false };
      break;
    case 'reactivate':
      if (target.is_active) {
        return NextResponse.json({ data: null, error: { message: 'User is already active', code: 'ALREADY_ACTIVE' } }, { status: 400 });
      }
      update = { is_active: true };
      break;
    case 'strike':
      update = { strike_count: target.strike_count + 1 };
      break;
    case 'promote':
      if (target.role === 'admin') {
        return NextResponse.json({ data: null, error: { message: 'User is already an admin', code: 'ALREADY_ADMIN' } }, { status: 400 });
      }
      update = { role: 'admin' };
      break;
  }

  const { error } = await adminClient
    .from('users')
    .update(update)
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ data: null, error: { message: error.message, code: 'DB_ERROR' } }, { status: 500 });
  }

  return NextResponse.json({ data: { action }, error: null });
}
