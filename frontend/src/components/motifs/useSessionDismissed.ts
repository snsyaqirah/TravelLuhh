// Session-long dismissal for NoticeSlips (§5.4): gone until the tab closes, back in a new session.
// Storage can be unavailable (private mode, blocked site data), so failures fall back to memory.
import { useCallback, useState } from 'react';

const PREFIX = 'travelluhh_notice_';
const memory = new Set<string>();

function read(key: string): boolean {
  if (memory.has(key)) return true;
  try {
    return window.sessionStorage.getItem(PREFIX + key) === '1';
  } catch {
    return false;
  }
}

/** [dismissed, dismiss]. Use a key per trip and threshold, e.g. `${tripId}:p90`. */
export function useSessionDismissed(key: string): [boolean, () => void] {
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const dismissed = dismissedKey === key || read(key);
  const dismiss = useCallback(() => {
    memory.add(key);
    try {
      window.sessionStorage.setItem(PREFIX + key, '1');
    } catch {
      // memory fallback above keeps it hidden for this page's life
    }
    setDismissedKey(key);
  }, [key]);
  return [dismissed, dismiss];
}
