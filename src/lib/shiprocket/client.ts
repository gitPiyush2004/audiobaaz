const BASE = 'https://apiv2.shiprocket.in/v1/external';

// Module-level token cache — valid within a single server process.
// Each server instance re-authenticates independently; no shared cache needed for V1.
let cachedToken: string | null = null;

async function authenticate(): Promise<string> {
  const email    = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;

  if (!email || !password) {
    throw new Error('SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD must be set');
  }

  const res = await fetch(`${BASE}/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, password }),
  });

  if (!res.ok) throw new Error(`Shiprocket auth failed: ${res.status}`);

  const json = await res.json() as { token: string };
  if (!json.token) throw new Error('Shiprocket auth returned no token');

  cachedToken = json.token;
  return cachedToken;
}

/**
 * Make an authenticated Shiprocket API request.
 * Automatically authenticates on first call and retries once on 401.
 */
export async function shiprocket(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = cachedToken ?? await authenticate();

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  // Token expired — re-authenticate and retry once
  if (res.status === 401) {
    cachedToken = null;
    const freshToken = await authenticate();
    return fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${freshToken}`,
        ...options.headers,
      },
    });
  }

  return res;
}
