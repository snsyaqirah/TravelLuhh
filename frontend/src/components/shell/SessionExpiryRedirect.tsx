import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SESSION_EXPIRED_EVENT, type SessionExpiredDetail } from '@/lib/axios';
import { isAuthPage } from '@/lib/session';

/**
 * The axios layer fires SESSION_EXPIRED_EVENT when a refresh fails; by default it hard-reloads to /login.
 * Inside the router we navigate instead, so the app (and any unsent draft in memory) is not thrown away.
 */
export function SessionExpiryRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const onExpired = (event: Event) => {
      event.preventDefault();
      const { pathname } = window.location;
      if (pathname === '/' || isAuthPage(pathname)) return;
      const next = (event as CustomEvent<SessionExpiredDetail>).detail?.next ?? pathname;
      navigate(`/login?next=${encodeURIComponent(next)}`, { replace: true });
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [navigate]);

  return null;
}
