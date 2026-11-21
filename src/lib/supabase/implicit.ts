import { createClient } from '@supabase/supabase-js';

// Browser client that uses the *implicit* auth flow, used only to SEND magic
// links. The default PKCE flow ties a magic link to the browser that requested
// it, so opening the email on another device (e.g. requesting on a laptop and
// tapping the link on a phone) fails with "link expired". Implicit-flow links
// carry the session tokens in the URL fragment and work on any device;
// /auth/confirm turns them into the normal cookie-based session.
export function createImplicitClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'implicit',
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
