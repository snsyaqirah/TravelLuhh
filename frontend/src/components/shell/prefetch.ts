// §13: three + r3f + drei load once, after first paint, prefetched on requestIdleCallback after login. The
// registry import pulls the 3D runtime chunks only; each scene stays its own lazy chunk.
import { useEffect } from 'react';
import { get3DGate } from '@/iso/gate';
import { prefetchIsoScenes } from '@/iso/prefetch';

let started = false;

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

/** Warm the 3D chunks when the browser is idle. Skipped when 3D is off for this session (SVG twins only). */
export function usePrefetch3D(enabled = true): void {
  useEffect(() => {
    if (!enabled || started || typeof window === 'undefined') return;
    const w = window as IdleWindow;
    const run = () => {
      if (started) return;
      started = true;
      if (!get3DGate().ok) return;
      // Through iso/prefetch so a stage mounted later finds the module already resolved (no extra tick).
      prefetchIsoScenes().catch(() => {
        // A failed prefetch is retried for real when a scene slot nears the viewport.
        started = false;
      });
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(run, { timeout: 4000 });
      return () => w.cancelIdleCallback?.(id);
    }
    // Safari has no requestIdleCallback.
    const id = window.setTimeout(run, 1500);
    return () => window.clearTimeout(id);
  }, [enabled]);
}
