import { Suspense, useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigationType } from 'react-router-dom';
import { useTrip } from '@/hooks/useTrips';
import { cn } from '@/lib/utils';
import { AppBar } from '@/components/shell/AppBar';
import { AppSkeleton } from '@/components/shell/AppSkeleton';
import { BottomBar } from '@/components/shell/BottomBar';
import { Rail } from '@/components/shell/Rail';
import { RouteErrorBoundary } from '@/components/shell/RouteErrorBoundary';
import { ShellProvider } from '@/components/shell/ShellProvider';
import { useShellOverrides } from '@/components/shell/chrome';
import { usePrefetch3D } from '@/components/shell/prefetch';
import { defaultChrome, routeFadeKey, tripIdFromPath } from '@/components/shell/routeMeta';

/** New pages start at the top; Back/Forward (POP) leaves the browser's own scroll restoration alone. */
function useScrollReset(key: string) {
  const navType = useNavigationType();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (navType !== 'POP') window.scrollTo(0, 0);
  }, [key, navType]);
}

function ShellFrame() {
  const { pathname, search } = useLocation();
  const overrides = useShellOverrides();
  const defaults = defaultChrome(pathname);
  const tripId = tripIdFromPath(pathname);
  const { trip, isLoading: tripLoading } = useTrip(tripId ?? undefined, { enabled: tripId !== null });

  const title = overrides.title ?? (tripId ? (trip?.name ?? (tripLoading ? '' : 'Trip')) : defaults.title);
  const titlePending = tripId !== null && overrides.title === undefined && !trip && tripLoading;
  // A sheet in the URL (?sheet=log-spend|logbook|edit) covers the bottom of the screen; so does the create flow.
  const showBottomBar = !(overrides.hideBottomBar ?? defaults.hideBottomBar) && !new URLSearchParams(search).has('sheet');
  const showAppBar = !overrides.hideAppBar;

  const fadeKey = routeFadeKey(pathname);
  useScrollReset(fadeKey);
  usePrefetch3D();

  return (
    <div className="flex min-h-dvh bg-background">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-leaf px-4 py-2 text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <Rail className="hidden md:flex" />

      <div className="flex min-w-0 flex-1 flex-col">
        {showAppBar ? (
          <AppBar
            className="md:hidden"
            title={title}
            brand={overrides.title === undefined && !overrides.backTo && defaults.brand}
            backTo={overrides.backTo ?? defaults.backTo}
            backLabel={overrides.backLabel ?? defaults.backLabel}
            titlePending={titlePending}
          />
        ) : null}

        <main
          id="main"
          tabIndex={-1}
          className={cn(
            'mx-auto w-full max-w-[1168px] flex-1 px-4 pt-4 outline-none md:px-6 md:pb-12 md:pt-8 lg:pt-10',
            // clear the fixed BottomBar (64px), the FAB's 12px rise, and the home indicator
            showBottomBar ? 'pb-[calc(88px+env(safe-area-inset-bottom))]' : 'pb-8'
          )}
        >
          {/* Keyed on the full path, so moving to another tab or page clears a crash. */}
          <RouteErrorBoundary resetKey={pathname}>
            <Suspense fallback={<AppSkeleton />}>
              {/* Route change = 150ms opacity fade only (§10). Fill 'backwards' leaves no opacity (and no
                  stacking context) behind once it ends. Tabs of one trip share a key, so they don't fade. */}
              <div key={fadeKey} className="animate-crossfade" style={{ animationFillMode: 'backwards' }}>
                <Outlet />
              </div>
            </Suspense>
          </RouteErrorBoundary>
        </main>
      </div>

      {showBottomBar ? <BottomBar className="md:hidden" /> : null}
    </div>
  );
}

/**
 * The signed-in app frame (§6.3): Rail on tablet/desktop, AppBar + BottomBar on phones, and the content
 * column (max 1120px, 16px gutters on phones, 24px from 768). No top navbar. Renders the matched route
 * through <Outlet />.
 */
export function Layout() {
  return (
    <ShellProvider>
      <ShellFrame />
    </ShellProvider>
  );
}
