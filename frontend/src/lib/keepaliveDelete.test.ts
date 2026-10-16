import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '@/lib/axios';
import { keepaliveDelete, onPageHidden } from '@/lib/keepaliveDelete';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  delete (document as { visibilityState?: string }).visibilityState;
});

describe('keepaliveDelete', () => {
  it('sends DELETE with keepalive and the access token; success needs no fallback', async () => {
    localStorage.setItem('travelluhh_token', 'acc');
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const fallback = vi.fn();
    await keepaliveDelete('/trips/2/packing/9', fallback);
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/trips/2/packing/9`, {
      method: 'DELETE',
      keepalive: true,
      headers: { Authorization: 'Bearer acc' },
    });
    expect(fallback).not.toHaveBeenCalled();
  });

  it('falls back to the normal request when fetch is missing, refuses to send, or the token expired', async () => {
    const fallback = vi.fn().mockResolvedValue('axios');
    vi.stubGlobal('fetch', undefined);
    await expect(keepaliveDelete('/expenses/1', fallback)).resolves.toBe('axios');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('keepalive quota')));
    await expect(keepaliveDelete('/expenses/1', fallback)).resolves.toBe('axios');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    await expect(keepaliveDelete('/expenses/1', fallback)).resolves.toBe('axios');
    expect(fallback).toHaveBeenCalledTimes(3);
  });

  it('a server refusal rejects with its message (so the row is put back), without retrying', async () => {
    const body = JSON.stringify({ status: 403, message: "You don't have permission to do that on this trip." });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 403, headers: { 'Content-Type': 'application/json' } })));
    const fallback = vi.fn();
    await expect(keepaliveDelete('/expenses/1', fallback)).rejects.toMatchObject({
      message: "You don't have permission to do that on this trip.",
      status: 403,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>', { status: 502 })));
    await expect(keepaliveDelete('/expenses/1', fallback)).rejects.toMatchObject({ message: "That entry wasn't removed. Try again." });
    expect(fallback).not.toHaveBeenCalled();
  });
});

describe('onPageHidden', () => {
  it('fires on pagehide and on visibilitychange to hidden, not to visible; unsubscribes', () => {
    const fn = vi.fn();
    const off = onPageHidden(fn);
    window.dispatchEvent(new Event('pagehide'));
    document.dispatchEvent(new Event('visibilitychange')); // still visible
    expect(fn).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(fn).toHaveBeenCalledTimes(2);
    off();
    window.dispatchEvent(new Event('pagehide'));
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
