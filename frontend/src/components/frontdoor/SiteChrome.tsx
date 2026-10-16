// The Landing's own top bar and footer (public pages sit outside the app shell).
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/brand/Wordmark';

export function SiteBar() {
  return (
    <header className="border-b border-rule bg-paper">
      <div className="mx-auto flex h-16 max-w-[1168px] items-center justify-between gap-2 px-4 lg:px-6">
        <Link to="/" className="inline-flex min-h-11 shrink-0 items-center rounded-sm" aria-label="TravelLuhh, front page">
          <Wordmark size="sm" className="sm:hidden" />
          <Wordmark size="md" className="hidden sm:inline-flex" />
        </Link>
        <nav aria-label="Account" className="flex items-center gap-1 sm:gap-3">
          <Button asChild variant="ghost" className="px-2.5 sm:px-4">
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild className="px-3 sm:px-4">
            <Link to="/register">Start a tabung</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-rule bg-paper">
      <div className="mx-auto flex max-w-[1168px] flex-col gap-5 px-4 py-8 sm:flex-row sm:items-end sm:justify-between lg:px-6">
        <div className="flex flex-col gap-2">
          <Wordmark size="sm" />
          <p className="type-body-s text-ink-2">Made in Malaysia by Syaqirah</p>
        </div>
        <a
          href="https://github.com/snsyaqirah"
          target="_blank"
          rel="noreferrer"
          className="type-body-s inline-flex min-h-11 items-center gap-1 self-start text-ink underline decoration-rule-strong underline-offset-[3px] hover:decoration-ink sm:self-auto"
        >
          GitHub
          <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>
    </footer>
  );
}
