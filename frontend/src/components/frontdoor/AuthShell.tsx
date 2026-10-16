// Auth page frame (§9.2). Desktop: 50/50, the form on paper (max 380px, vertically centred) and a fund panel
// (leaf in dark) with the static closed suitcase and one Newsreader italic line. Mobile: a 96px band with the
// suitcase cropped so its tag still shows, then the form full width. No WebGL on these pages.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Wordmark } from '@/components/brand/Wordmark';
import { ClosedSuitcaseSvg } from '@/iso/svg/SuitcaseSvg';
import { cn } from '@/lib/utils';
import { LuggageTag, type LuggageTagProps } from './LuggageTag';

export interface AuthShellProps {
  /** The panel's Newsreader italic line, e.g. "Welcome back. Your tabung's where you left it." */
  line: string;
  /** Up to 5 characters printed on the suitcase's own tag (an airport or country code). */
  caseTag?: string;
  /** The big paper tag beside the case; Register's profile step fills it live. */
  luggage?: Omit<LuggageTagProps, 'className'> | null;
  children: ReactNode;
}

/** Wordmark in on-fund over the light fund panel, ink over the dark leaf panel. */
function PanelWordmark({ size }: { size: 'sm' | 'md' }) {
  return (
    <>
      <Wordmark size={size} tone="onFund" className="dark:hidden" />
      <Wordmark size={size} tone="ink" className="hidden dark:inline-flex" />
    </>
  );
}

export function AuthShell({ line, caseTag, luggage, children }: AuthShellProps) {
  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-2">
      {/* Mobile and tablet: the illustration band. */}
      <div className="relative h-24 overflow-hidden border-b border-rule bg-fund dark:bg-leaf lg:hidden">
        <Link
          to="/"
          className="absolute left-4 top-1/2 inline-flex min-h-11 -translate-y-1/2 items-center rounded-sm"
          aria-label="TravelLuhh, front page"
        >
          <PanelWordmark size="md" />
        </Link>
        <ClosedSuitcaseSvg width={176} tag={caseTag} className="pointer-events-none absolute -bottom-1 -right-3 sm:right-8" />
      </div>

      {/* The form column. */}
      <div className="flex min-h-[calc(100dvh-6rem)] flex-col px-4 pb-12 pt-6 sm:px-8 lg:min-h-dvh lg:px-12 lg:py-8">
        <div className="hidden lg:block">
          <Link to="/" className="inline-flex min-h-11 items-center rounded-sm" aria-label="TravelLuhh, front page">
            <Wordmark size="md" />
          </Link>
        </div>
        <main id="main" className="flex flex-1 flex-col lg:justify-center">
          <div className="w-full max-w-[380px] sm:mx-auto lg:py-12">{children}</div>
        </main>
      </div>

      {/* Desktop: the fund panel. Decorative; the page title and form say everything it says. */}
      <aside
        aria-hidden="true"
        className="sticky top-0 hidden h-dvh flex-col justify-between overflow-hidden bg-fund px-12 py-10 text-on-fund dark:bg-leaf dark:text-ink lg:flex"
      >
        <p className="type-overline opacity-80">A tabung for every trip</p>
        <div className={cn('relative flex items-end gap-6', luggage ? 'pr-0' : 'pr-12')}>
          <ClosedSuitcaseSvg width={340} tag={caseTag} className="shrink-0" />
          {luggage ? <LuggageTag {...luggage} className="-ml-16 mb-24 shrink-0 -rotate-3" /> : null}
        </div>
        <p className="max-w-[20ch] font-display text-[34px] font-medium italic leading-[42px] tracking-[-0.01em]">{line}</p>
      </aside>
    </div>
  );
}
