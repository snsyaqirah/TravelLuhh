// DOM-side hooks for IsoStage. No three.js here: this file ships in the page bundle.
import { useEffect, useLayoutEffect, useState, useSyncExternalStore, type RefObject } from 'react';
import { useTheme } from 'next-themes';
import type { ThemeName } from '@/design/tokens';
import { get3DGate, subscribe3DPreference, type GateResult } from '@/iso/gate';

type Subscribe = (cb: () => void) => () => void;
const mediaSubscribers = new Map<string, Subscribe>();

// One stable subscribe function per query, so useSyncExternalStore doesn't resubscribe every render.
function subscribeMedia(query: string): Subscribe {
  let sub = mediaSubscribers.get(query);
  if (!sub) {
    sub = (cb) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener?.('change', cb);
      return () => mql.removeEventListener?.('change', cb);
    };
    mediaSubscribers.set(query, sub);
  }
  return sub;
}

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    subscribeMedia(query),
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  );
}

export const useReducedMotion = () => useMedia('(prefers-reduced-motion: reduce)');
export const usePrinting = () => useMedia('print');

function readHtmlTheme(): ThemeName {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function subscribeHtmlClass(cb: () => void) {
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return () => {};
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => mo.disconnect();
}

/** next-themes' resolvedTheme when a ThemeProvider is mounted, else the `.dark` class on <html>. */
export function useIsoTheme(override?: ThemeName): ThemeName {
  const { resolvedTheme } = useTheme();
  const htmlTheme = useSyncExternalStore(subscribeHtmlClass, readHtmlTheme, () => 'light' as ThemeName);
  if (override) return override;
  if (resolvedTheme === 'dark' || resolvedTheme === 'light') return resolvedTheme;
  return htmlTheme;
}

export interface Size {
  w: number;
  h: number;
}

/** Content-box size of an element, measured before paint and on every resize. */
export function useElementSize(ref: RefObject<HTMLElement>): Size | null {
  const [size, setSize] = useState<Size | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      setSize((prev) => (prev && prev.w === r.width && prev.h === r.height ? prev : { w: r.width, h: r.height }));
    };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/** True once/while the element intersects the viewport grown by `margin`. `once` latches the first hit. */
export function useInView(ref: RefObject<HTMLElement>, margin: string, once = false): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (once && hit) {
          setInView(true);
          io.disconnect();
        } else if (!once) setInView(hit);
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin, once]);
  return inView;
}

const subscribeVisibility: Subscribe = (cb) => {
  document.addEventListener('visibilitychange', cb);
  return () => document.removeEventListener('visibilitychange', cb);
};

export function usePageVisible(): boolean {
  return useSyncExternalStore(subscribeVisibility, () => document.visibilityState !== 'hidden', () => true);
}

/** The live gate. Re-evaluates when the user flips the 3D setting or after a context loss (`bump`). */
export function use3DGate(bump = 0): GateResult {
  const [gate, setGate] = useState<GateResult>(() => get3DGate());
  useEffect(() => {
    setGate(get3DGate());
    return subscribe3DPreference(() => setGate(get3DGate()));
  }, [bump]);
  return gate;
}

export const useCoarsePointer = () => useMedia('(pointer: coarse)');
