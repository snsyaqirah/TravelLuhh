import { Link, useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { BalangMark, Wordmark } from '@/components/brand/Wordmark';
import { ThemeToggle } from '@/components/theme/ThemeProvider';
import { UserSquare } from '@/components/shell/UserSquare';
import { NAV_ITEMS, isNavActive, type NavItem } from '@/components/shell/routeMeta';
import { useTabungTotal } from '@/components/shell/tabungTotal';
import { DESKTOP_QUERY, useMediaQuery } from '@/components/shell/useMediaQuery';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

function RailLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex items-center transition-colors duration-micro ease-out',
        // tablet: icon above label · desktop: mono index + label
        'h-[60px] flex-col justify-center gap-1 lg:h-10 lg:flex-row lg:justify-start lg:gap-3 lg:px-5',
        active
          ? 'bg-sidebar-accent text-sidebar-foreground'
          : 'text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
      )}
    >
      {active ? <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-sidebar-primary" /> : null}
      <Icon aria-hidden className="h-[22px] w-[22px] lg:hidden" strokeWidth={1.75} />
      <span aria-hidden className="hidden w-5 font-mono text-[11px] leading-4 lg:inline">
        {item.index}
      </span>
      <span className="text-[11px] font-medium leading-[14px] lg:text-[15px] lg:leading-5">{item.label}</span>
    </Link>
  );
}

/** Desktop-only bottom figure. Hidden entirely while loading or when a rate is missing (no fake sums). */
function TabungTotalBlock() {
  const total = useTabungTotal(true);
  if (!total) return null;
  return (
    <div className="flex flex-col gap-1">
      <p className="type-overline text-sidebar-muted">In tabung</p>
      <p className="type-money-l text-sidebar-foreground">
        {formatMoney(total.amount, total.currency, total.approx ? { approx: true, decimals: 'none' } : { decimals: 'auto' })}
      </p>
      <p className="type-label text-sidebar-muted">
        {total.trips === 1 ? 'Across 1 trip' : `Across ${total.trips} trips`}
        {total.approx ? " at today's rate" : ''}
      </p>
    </div>
  );
}

/**
 * Tablet (768–1023) 76px and desktop (≥1024) 232px rail (§6.3), styled as the passbook cover on the sidebar
 * colours. The focus ring switches to the brass sidebar ring here: the fund ring would vanish on fund green.
 */
export function Rail({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const creating = pathname === '/trips/new';

  return (
    <aside
      className={cn(
        'sticky top-0 h-dvh w-[76px] shrink-0 flex-col overflow-y-auto border-r border-transparent bg-sidebar text-sidebar-foreground scrollbar-none [--ring:var(--sidebar-ring)] dark:border-sidebar-border lg:w-[232px]',
        className
      )}
    >
      <div className="flex h-[72px] shrink-0 items-center justify-center lg:h-20 lg:justify-start lg:px-5">
        <Link to="/home" aria-label="TravelLuhh, home" className="inline-flex rounded-sm">
          <BalangMark size={28} tone="sidebar" className="lg:hidden" />
          <Wordmark tone="sidebar" className="hidden lg:inline-flex" />
        </Link>
      </div>

      <nav aria-label="Main">
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <RailLink item={item} active={isNavActive(item, pathname)} />
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-6 flex justify-center lg:block lg:px-5">
        <Link
          to="/trips/new"
          aria-current={creating ? 'page' : undefined}
          className="group flex flex-col items-center gap-1 lg:block"
        >
          <span className="flex h-12 w-12 items-center justify-center gap-2 rounded-lg bg-sidebar-primary font-semibold text-sidebar-primary-foreground shadow-hard transition-[transform,box-shadow] duration-press ease-out group-active:translate-x-[2px] group-active:translate-y-[2px] group-active:shadow-none lg:h-11 lg:w-full lg:text-[15px] lg:leading-5">
            <Plus aria-hidden className="h-6 w-6 lg:h-5 lg:w-5" strokeWidth={1.75} />
            <span className="hidden lg:inline">Start a tabung</span>
          </span>
          <span className="text-[11px] font-medium leading-[14px] text-sidebar-muted lg:hidden">New</span>
        </Link>
      </div>

      <div className="mt-auto flex flex-col items-center gap-5 px-3 pb-5 pt-8 lg:items-stretch lg:border-t lg:border-sidebar-border lg:px-5 lg:pt-5">
        {desktop ? <TabungTotalBlock /> : null}
        <ThemeToggle tone="sidebar" size="sm" className="hidden w-full lg:grid" />
        <Link
          to="/me"
          aria-label={desktop ? undefined : 'Me'}
          className="flex min-w-0 items-center gap-3 rounded-md lg:-mx-2 lg:px-2 lg:py-1.5 lg:hover:bg-sidebar-accent/60"
        >
          <UserSquare user={user} size={32} tone="sidebar" />
          <span className="hidden min-w-0 flex-col lg:flex">
            <span className="truncate text-[15px] font-medium leading-5 text-sidebar-foreground">
              {user?.name || 'Me'}
            </span>
            {user?.email ? (
              <span className="truncate font-mono text-[11px] leading-4 text-sidebar-muted">{user.email}</span>
            ) : null}
          </span>
        </Link>
      </div>
    </aside>
  );
}
