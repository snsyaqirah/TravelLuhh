// 404 (§9.9): GATE 404, "Wrong gate.", a ghost ticket where the boarding pass should be, and one way back.
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/brand/Wordmark';
import { GhostOutline } from '@/components/motifs/GhostOutline';

export default function NotFound() {
  const { isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  const home = isAuthenticated ? '/home' : '/';

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b border-rule">
        <div className="mx-auto flex h-16 max-w-[1168px] items-center px-4 lg:px-6">
          <Link to={home} className="inline-flex min-h-11 items-center rounded-sm" aria-label="TravelLuhh, home">
            <Wordmark size="md" />
          </Link>
        </div>
      </header>
      <main
        id="main"
        className="mx-auto grid w-full max-w-[1168px] flex-1 content-center gap-10 px-4 py-12 lg:grid-cols-12 lg:gap-6 lg:px-6"
      >
        <div className="lg:col-span-6">
          <p className="type-overline text-ink-2">Gate 404</p>
          <h1 className="type-display-2 mt-3 text-ink">Wrong gate.</h1>
          <p className="type-body mt-3 text-ink-2">This page doesn't exist.</p>
          <p className="type-ledger mt-5 break-all text-ink-3">
            <span className="sr-only">You asked for </span>
            {pathname}
          </p>
          <Button asChild size="lg" className="mt-8 w-full sm:w-auto">
            <Link to={home}>Back to Home</Link>
          </Button>
        </div>
        <div className="lg:col-span-5 lg:col-start-8">
          <GhostOutline kind="ticket" height={160} className="h-auto max-w-full" />
        </div>
      </main>
    </div>
  );
}
