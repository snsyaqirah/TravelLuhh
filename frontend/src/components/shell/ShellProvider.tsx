import { useMemo, useState, type ReactNode } from 'react';
import {
  ShellControlContext,
  ShellOverridesContext,
  applyChromeEntry,
  mergeChrome,
  type ChromeEntry,
  type ShellControl,
} from '@/components/shell/chrome';

/** Holds what pages asked of the shell through useShellChrome. Mounted once, by Layout. */
export function ShellProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<readonly ChromeEntry[]>([]);

  const control = useMemo<ShellControl>(
    () => ({ set: (id, chrome) => setEntries((prev) => applyChromeEntry(prev, id, chrome)) }),
    []
  );
  const overrides = useMemo(() => mergeChrome(entries), [entries]);

  return (
    <ShellControlContext.Provider value={control}>
      <ShellOverridesContext.Provider value={overrides}>{children}</ShellOverridesContext.Provider>
    </ShellControlContext.Provider>
  );
}
