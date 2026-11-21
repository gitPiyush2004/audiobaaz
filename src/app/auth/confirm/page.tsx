'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// Landing page for email magic links (implicit flow). Supabase redirects here
// with the session in the URL fragment (#access_token=…&refresh_token=…),
// which never reaches the server, so the session is established client-side.
export default function AuthConfirmPage() {
  const [message, setMessage] = useState('Signing you in…');

  useEffect(() => {
    async function finish() {
      const query = new URLSearchParams(window.location.search);
      const hash  = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const rawNext = query.get('next') ?? '/dashboard';
      const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard';

      // PKCE-style link (?code=…) — let the server route handle it.
      if (query.get('code') || query.get('token_hash')) {
        window.location.replace(`/auth/callback${window.location.search}`);
        return;
      }

      const access_token  = hash.get('access_token');
      const refresh_token = hash.get('refresh_token');
      const supabase = createClient();

      if (!access_token || !refresh_token) {
        // The link was already used (e.g. the user typed the code from the same
        // email) or has expired. If this device is already signed in, just continue.
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          window.location.replace(next);
          return;
        }
        const code = hash.get('error_code') ?? query.get('error_code');
        window.location.replace(`/login?error=${code === 'otp_expired' ? 'link_used' : 'auth'}`);
        return;
      }

      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) {
        window.location.replace('/login?error=auth');
        return;
      }

      // Approve the cross-device request so the device that asked for the link
      // (e.g. a laptop) signs in too.
      const rid = query.get('rid');
      if (rid) {
        const res = await fetch('/api/auth/login-request', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: rid }),
        }).catch(() => null);
        if (res?.ok) {
          setMessage('Signed in. If you requested the link on another device, it is signing in now too — redirecting…');
          await new Promise(r => setTimeout(r, 2500));
        }
      } else {
        setMessage('Signed in — redirecting…');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle();
        if (!profile?.full_name) {
          window.location.replace(`/onboarding?next=${encodeURIComponent(next)}`);
          return;
        }
      }
      window.location.replace(next);
    }
    finish();
  }, []);

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', color: '#0a0a0a', padding: '24px',
    }}>
      <p style={{ fontSize: '14px', letterSpacing: '0.02em', maxWidth: 420, textAlign: 'center', lineHeight: 1.6 }}>{message}</p>
    </div>
  );
}
