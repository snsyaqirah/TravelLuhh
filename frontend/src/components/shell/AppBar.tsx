import { Link, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Wordmark } from '@/components/brand/Wordmark';
import { Skeleton } from '@/components/ui/skeleton';
import { UserSquare } from '@/components/shell/UserSquare';
import { cn } from '@/lib/utils';

export interface AppBarProps {
  title: string;
  /** Show the wordmark instead of the title (Home). */
  brand?: boolean;
  backTo?: string;
  backLabel?: string;
  /** Title still loading (a trip's name): a short sunken block holds its place. */
  titlePending?: boolean;
  className?: string;
}

/** Mobile (<768) top bar (§6.3): 52px, solid paper, bottom rule. Title or back chevron + name; you, on the right. */
export function AppBar({ title, brand, backTo, backLabel, titlePending, className }: AppBarProps) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const onMe = pathname === '/me';

  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b border-rule bg-paper pt-[env(safe-area-inset-top)]',
        className
      )}
    >
      <div className="flex h-[52px] items-center gap-1 px-4">
        {backTo ? (
          <Link
            to={backTo}
            aria-label={backLabel ?? 'Back'}
            className="-ml-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink hover:bg-accent"
          >
            <ChevronLeft aria-hidden className="h-6 w-6" strokeWidth={1.75} />
          </Link>
        ) : null}

        <div className="min-w-0 flex-1">
          {brand ? (
            <Link to="/home" aria-label="TravelLuhh, home" className="inline-flex rounded-sm">
              <Wordmark size="sm" />
            </Link>
          ) : titlePending ? (
            <Skeleton className="h-4 w-32" />
          ) : (
            <p className="type-title truncate text-ink">{title}</p>
          )}
        </div>

        <Link
          to="/me"
          aria-label="Me"
          aria-current={onMe ? 'page' : undefined}
          className="-mr-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-md"
        >
          <UserSquare user={user} size={32} />
        </Link>
      </div>
    </header>
  );
}
