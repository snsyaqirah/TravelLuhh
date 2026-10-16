// DELETE that survives the page going away. An undo-delete still waiting when the tab is hidden or closed is
// sent with fetch({ keepalive: true }): an axios XHR started on pagehide is often cancelled with the page.
// Anything keepalive can't settle here (no fetch, the request refused locally, an expired access token)
// falls back to the normal axios call, which refreshes the token and retries.
import { API_BASE_URL, AppError } from '@/lib/axios';
import { getAccessToken } from '@/lib/session';

/** Pagehide, or the document turning hidden (mobile browsers often skip pagehide when a tab is killed). */
export function onPageHidden(fn: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') fn();
  };
  window.addEventListener('pagehide', fn);
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    window.removeEventListener('pagehide', fn);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

/**
 * DELETE `path` (relative to the API root, e.g. '/expenses/42') with keepalive. Resolves when the server
 * accepted it; rejects with an AppError for a server refusal; uses `fallback` when keepalive can't do it.
 */
export async function keepaliveDelete(path: string, fallback: () => Promise<unknown>): Promise<unknown> {
  if (typeof fetch !== 'function') return fallback();
  const token = getAccessToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'DELETE',
      keepalive: true,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    // Not sent (keepalive quota, offline, blocked): the normal path reports the problem or retries.
    return fallback();
  }
  if (res.ok) return undefined;
  if (res.status === 401) return fallback(); // token expired: axios refreshes and retries
  let message: string | undefined;
  try {
    const body = (await res.json()) as { message?: unknown } | null;
    if (body && typeof body.message === 'string' && body.message.trim()) message = body.message.trim();
  } catch {
    // no JSON body
  }
  throw new AppError(message ?? "That entry wasn't removed. Try again.", { status: res.status });
}
