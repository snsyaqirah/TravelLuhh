import { useCallback, useSyncExternalStore } from 'react';

function query(q: string): MediaQueryList | null {
  try {
    return typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q) : null;
  } catch {
    return null;
  }
}

/** Live media query match. Read synchronously on first render, so nothing flashes. */
export function useMediaQuery(q: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = query(q);
      if (!mql) return () => {};
      mql.addEventListener?.('change', onChange);
      return () => mql.removeEventListener?.('change', onChange);
    },
    [q]
  );
  return useSyncExternalStore(
    subscribe,
    () => query(q)?.matches ?? false,
    () => false
  );
}

/** Tailwind lg (1024px): the wide rail with the wordmark and the tabung total. */
export const DESKTOP_QUERY = '(min-width: 1024px)';
