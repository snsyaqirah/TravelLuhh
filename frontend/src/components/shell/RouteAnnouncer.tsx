// Route changes for keyboard and screen-reader users (E3 known gap): the tab title follows the page, a polite
// live region names the new page, and focus moves to <main> so Tab starts from the page, not the old link.
// Tabs of one trip share a page key, so switching tabs never steals focus from the tab strip.
import { useEffect, useRef, useState } from 'react';
import { documentTitleFor } from '@/components/shell/routeMeta';

export interface RouteAnnouncerProps {
  /** The page's title as the AppBar shows it ('' while a trip name loads). */
  title: string;
  /** Changes once per page (routeFadeKey(pathname)): announce and move focus only when it changes. */
  pageKey: string;
  /** Element to focus after a page change. Default: #main. */
  focusId?: string;
}

export function RouteAnnouncer({ title, pageKey, focusId = 'main' }: RouteAnnouncerProps) {
  const [message, setMessage] = useState('');
  const lastKey = useRef<string | null>(null);
  const pendingAnnounce = useRef(false);

  useEffect(() => {
    document.title = documentTitleFor(title);
  }, [title]);

  // A new page: remember to announce it once its title is known (a trip's name arrives after its fetch).
  useEffect(() => {
    if (lastKey.current === null) {
      lastKey.current = pageKey; // first load: the browser already reads the document
      return;
    }
    if (lastKey.current === pageKey) return;
    lastKey.current = pageKey;
    pendingAnnounce.current = true;
    const el = document.getElementById(focusId);
    // Don't pull focus out of a field or dialog the new page opened on its own.
    const active = document.activeElement;
    const inPage = active && el?.contains(active) && active !== el;
    if (el && !inPage) el.focus({ preventScroll: true });
  }, [pageKey, focusId]);

  useEffect(() => {
    if (!pendingAnnounce.current || !title.trim()) return;
    pendingAnnounce.current = false;
    const t = title.trim();
    // Same words as last time still have to change the region's text, or nothing is read out.
    setMessage((prev) => (prev === t ? `${t}\u00a0` : t));
  }, [title, pageKey]);

  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}
