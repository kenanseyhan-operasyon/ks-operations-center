export type AuthCallback = { type: 'signup' | 'recovery'; accessToken: string; refreshToken: string; expiresIn: number } | { error: string };

const authKeys = ['access_token', 'refresh_token', 'expires_in', 'expires_at', 'token_type', 'type', 'error', 'error_code', 'error_description', 'code', 'token_hash'];

/** Remove credentials before the scene or any external imagery is loaded. Tokens stay in memory only. */
export function takeAuthCallback(location: Pick<Location, 'href'>, history: Pick<History, 'replaceState' | 'state'>): AuthCallback | undefined {
  const url = new URL(location.href), hash = new URLSearchParams(url.hash.slice(1));
  if (!['access_token', 'refresh_token', 'error', 'error_code', 'token_hash'].some(k => hash.has(k) || url.searchParams.has(k)) && !url.searchParams.has('code')) return;
  const read = (key: string) => hash.get(key) || url.searchParams.get(key) || '';
  const type = read('type'), accessToken = read('access_token'), refreshToken = read('refresh_token');
  const expiresIn = Math.min(3600, Math.max(1, Number(read('expires_in')) || 3600));
  const error = read('error_code') || (read('error') ? 'invalid_link' : '');
  authKeys.forEach(k => { hash.delete(k); url.searchParams.delete(k); });
  url.hash = hash.toString();
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  if (error) return { error };
  if (!accessToken || !refreshToken || !['signup', 'recovery'].includes(type)) return { error: 'invalid_link' };
  return { type: type as 'signup' | 'recovery', accessToken, refreshToken, expiresIn };
}

/** Use the exact site root; recovery type is returned by Supabase in the fragment. */
export const authRedirectUrl = (url: string) => new URL('/', url).href;
