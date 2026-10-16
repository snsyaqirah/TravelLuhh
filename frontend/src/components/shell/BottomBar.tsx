import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ContextFab } from '@/components/shell/ContextFab';
import { NAV_ITEMS, isNavActive, type NavItem } from '@/components/shell/routeMeta';

function BarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        // labels share a baseline with the FAB's label, 8px above the bar's bottom edge
        'relative flex h-full flex-col items-center justify-end gap-1 pb-2 transition-colors duration-micro ease-out',
        active ? 'text-ink' : 'text-ink-3 hover:text-ink-2'
      )}
    >
      {/* The 2px fund bar sits on the bar's top rule. */}
      {active ? <span aria-hidden className="absolute inset-x-3 -top-px h-0.5 bg-fund" /> : null}
      <Icon aria-hidden className="h-[22px] w-[22px]" strokeWidth={1.75} />
      <span className="text-[11px] font-medium leading-[14px]">{item.label}</span>
    </Link>
  );
}

/** Mobile (<768) tab bar (§6.3): Home · Trips · [ContextFab] · Passport · Me. Solid leaf, no blur. */
export function BottomBar({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const [home, trips, passport, me] = NAV_ITEMS;

  return (
    <nav
      aria-label="Main"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-leaf pb-[env(safe-area-inset-bottom)]',
        className
      )}
    >
      {/* Fixed 64px row: the raised FAB overflows upward instead of stretching the row. */}
      <ul className="mx-auto grid h-16 max-w-[560px] grid-cols-5 grid-rows-[4rem]">
        <li>
          <BarLink item={home} active={isNavActive(home, pathname)} />
        </li>
        <li>
          <BarLink item={trips} active={isNavActive(trips, pathname)} />
        </li>
        <li className="flex items-start justify-center">
          <ContextFab />
        </li>
        <li>
          <BarLink item={passport} active={isNavActive(passport, pathname)} />
        </li>
        <li>
          <BarLink item={me} active={isNavActive(me, pathname)} />
        </li>
      </ul>
    </nav>
  );
}
