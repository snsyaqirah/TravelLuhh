// Ledger-style tabs (§5.4): words, not pills. The active tab is ink with a 2px fund underline that moves to
// the new tab (no sliding content). Scrolls sideways with the scrollbar hidden; arrow keys move between tabs.
import { useCallback, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { ledgerPanelId, ledgerTabId } from '@/components/motifs/ledgerTabsIds';

export interface LedgerTab<K extends string = string> {
  key: K;
  label: string;
  count?: number;
}

export interface LedgerTabsProps<K extends string = string> {
  tabs: readonly LedgerTab<K>[];
  value: K;
  onChange: (key: K) => void;
  /** Names the tab list for screen readers, e.g. "Trip sections". */
  ariaLabel: string;
  /**
   * Id stem. Each tab gets ledgerTabId(idBase, key) and controls ledgerPanelId(idBase, key): give your panel
   * role="tabpanel", that id and aria-labelledby={ledgerTabId(idBase, key)}.
   */
  idBase?: string;
  className?: string;
}

export function LedgerTabs<K extends string = string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  idBase: idBaseProp,
  className,
}: LedgerTabsProps<K>) {
  const autoId = useId().replace(/:/g, '');
  const idBase = idBaseProp ?? `lt${autoId}`;
  const listRef = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null);

  const measure = useCallback(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !active) return setBar(null);
    setBar({ left: active.offsetLeft, width: active.offsetWidth });
  }, []);

  useLayoutEffect(() => {
    measure();
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    active?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    if (!list || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => ro.disconnect();
  }, [measure, value, tabs]);

  const focusTab = (index: number) => {
    const n = tabs.length;
    const i = ((index % n) + n) % n;
    onChange(tabs[i].key);
    listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[i]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key === 'ArrowRight') focusTab(index + 1);
    else if (e.key === 'ArrowLeft') focusTab(index - 1);
    else if (e.key === 'Home') focusTab(0);
    else if (e.key === 'End') focusTab(tabs.length - 1);
    else return;
    e.preventDefault();
  };

  return (
    <div className={cn('relative', className)}>
      <div
        ref={listRef}
        role="tablist"
        aria-label={ariaLabel}
        // the rule is an inset line so the active underline can sit on top of it inside the scroller
        className="scrollbar-none relative flex gap-5 overflow-x-auto px-0.5 shadow-[inset_0_-1px_0_hsl(var(--rule))] md:gap-7"
      >
        {tabs.map((tab, i) => {
          const selected = tab.key === value;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={ledgerTabId(idBase, tab.key)}
              aria-selected={selected}
              aria-controls={ledgerPanelId(idBase, tab.key)}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.key)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                'relative flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap font-sans text-[15px] font-medium leading-5 transition-colors duration-micro',
                // inset focus ring: the list scrolls, so an outside ring would be clipped
                'focus-visible:outline-offset-[-2px]',
                selected ? 'text-ink' : 'text-ink-2 hover:text-ink',
              )}
            >
              {tab.label}
              {tab.count != null ? <span className="font-mono text-[13px] font-normal tabular-nums text-ink-3">{tab.count}</span> : null}
            </button>
          );
        })}
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute bottom-0 left-0 h-0.5 bg-fund transition-[transform,width] duration-ui ease-out',
            !bar && 'opacity-0',
          )}
          style={bar ? { width: bar.width, transform: `translateX(${bar.left}px)` } : undefined}
        />
      </div>
    </div>
  );
}
