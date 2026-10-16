// Lets a page adjust the shell without owning it: the mobile AppBar title or back target, and whether the
// BottomBar shows (hide it while the page has a sheet open). Registrations are per component and undone on
// unmount, so a page never has to clean up after itself. Outside a ShellProvider the hook is a no-op.
import { createContext, useContext, useId, useLayoutEffect } from 'react';

export interface ShellChrome {
  /** Mobile AppBar title. Defaults per route: Home, Trips, the trip's name, Passport, Me. */
  title?: string;
  /** Show a back chevron that links here, before the title. */
  backTo?: string;
  /** Accessible name for the back chevron, e.g. "Back to Trips". */
  backLabel?: string;
  /** Hide the mobile BottomBar and its ContextFab (sheets, full-screen flows). */
  hideBottomBar?: boolean;
  /** Hide the mobile AppBar (a page that draws its own top bar). */
  hideAppBar?: boolean;
}

export type ChromeEntry = readonly [id: string, chrome: ShellChrome];

export interface ShellControl {
  set(id: string, chrome: ShellChrome | null): void;
}

export const ShellControlContext = createContext<ShellControl | null>(null);
export const ShellOverridesContext = createContext<ShellChrome>({});

/** Later registrations (deeper or newer components) win field by field; undefined never overrides. */
export function mergeChrome(entries: readonly ChromeEntry[]): ShellChrome {
  const out: Record<string, unknown> = {};
  for (const [, chrome] of entries) {
    for (const [k, v] of Object.entries(chrome)) {
      if (v !== undefined) out[k] = v;
    }
  }
  return out as ShellChrome;
}

/** Insert, replace in place, or (chrome = null) remove one registration. Returns prev when nothing changes. */
export function applyChromeEntry(
  prev: readonly ChromeEntry[],
  id: string,
  chrome: ShellChrome | null
): readonly ChromeEntry[] {
  const at = prev.findIndex(([k]) => k === id);
  if (!chrome) return at < 0 ? prev : prev.filter(([k]) => k !== id);
  if (at < 0) return [...prev, [id, chrome]];
  const next = prev.slice();
  next[at] = [id, chrome];
  return next;
}

/**
 * Adjust the shell chrome while the calling component is mounted.
 *
 *   useShellChrome({ hideBottomBar: sheetOpen });
 *   useShellChrome({ title: 'Edit trip', backTo: `/trips/${id}` });
 */
export function useShellChrome(chrome: ShellChrome): void {
  const control = useContext(ShellControlContext);
  const id = useId();
  const { title, backTo, backLabel, hideBottomBar, hideAppBar } = chrome;

  // Layout effects so the bar is right on the page's first paint, not one frame later.
  useLayoutEffect(() => {
    control?.set(id, { title, backTo, backLabel, hideBottomBar, hideAppBar });
  }, [control, id, title, backTo, backLabel, hideBottomBar, hideAppBar]);

  useLayoutEffect(() => () => control?.set(id, null), [control, id]);
}

/** The merged page overrides. For shell components; pages use useShellChrome. */
export function useShellOverrides(): ShellChrome {
  return useContext(ShellOverridesContext);
}
