// DOM overlays for a scene (§7.8 items 9–10): labels as leaf chips and targets as real buttons, both placed
// with toScreen. No text in WebGL and no raycasting. Recomputed on resize/data change, never per frame.
import { useMemo, type CSSProperties } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toScreen } from '@/iso/projection';
import { MAX_VISIBLE_LABELS, labelVisibility, placeTargets } from '@/iso/overlay';
import type { LabelTone, SceneLabel, SceneTarget } from '@/iso/specs';
import type { IsoView } from '@/iso/types';

const TONE: Record<LabelTone, string> = {
  ink: 'text-ink',
  fund: 'text-fund',
  stamp: 'text-stamp',
  muted: 'text-ink-3',
};

const ANCHOR: Record<NonNullable<SceneLabel['anchor']>, string> = {
  above: 'translate(-50%, calc(-100% - 6px))',
  below: 'translate(-50%, 6px)',
  left: 'translate(calc(-100% - 6px), -50%)',
  right: 'translate(6px, -50%)',
};

export interface SceneLabelsProps {
  labels: readonly SceneLabel[];
  view: IsoView;
  size: { w: number; h: number };
  /** Focused or hovered target id: reveals its label even beyond the cap, and any focusOnly label. */
  activeId?: string | null;
  /** Labels always visible (by priority; focusOnly labels excluded). Default 4 (§7.8). */
  maxVisible?: number;
  className?: string;
}

export function SceneLabels({ labels, view, size, activeId, maxVisible = MAX_VISIBLE_LABELS, className }: SceneLabelsProps) {
  const placed = useMemo(
    () =>
      labelVisibility(labels, maxVisible).map(({ label, always }) => {
        const [x, y] = toScreen(label.at, view.zoom, view.center, size.w, size.h);
        return { label, x, y, always };
      }),
    [labels, view.zoom, view.center, size.w, size.h, maxVisible],
  );

  return (
    <div className={cn('pointer-events-none absolute inset-0', className)} aria-hidden="true">
      {placed.map(({ label, x, y, always }) => {
        if (!always && label.id !== activeId) return null;
        const style: CSSProperties = {
          transform: `translate(${Math.round(x)}px, ${Math.round(y)}px) ${ANCHOR[label.anchor ?? 'above']}`,
        };
        return (
          <span
            key={label.id}
            style={style}
            className={cn(
              'absolute left-0 top-0 flex flex-col whitespace-nowrap rounded-sm border border-rule bg-leaf px-1.5 py-0.5',
              TONE[label.tone ?? 'ink'],
            )}
          >
            <span className="type-ledger">{label.text}</span>
            {label.sub ? <span className="type-overline text-ink-3">{label.sub}</span> : null}
          </span>
        );
      })}
    </div>
  );
}

export interface SceneTargetsProps {
  targets: readonly SceneTarget[];
  view: IsoView;
  size: { w: number; h: number };
  onTarget?: (target: SceneTarget) => void;
  /** Called with the target id on hover/focus, null on leave/blur (drives label reveal). */
  onActive?: (id: string | null) => void;
}

const TARGET_CLASS =
  'pointer-events-auto absolute left-0 top-0 rounded-sm outline-none transition-colors hover:bg-ink/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export function SceneTargets({ targets, view, size, onTarget, onActive }: SceneTargetsProps) {
  const inRouter = useInRouterContext();
  const placed = useMemo(() => placeTargets(targets, view, size), [targets, view, size]);
  return (
    <div className="pointer-events-none absolute inset-0">
      {placed.map(({ target, x, y, size: s }) => {
        const style: CSSProperties = {
          width: s,
          height: s,
          transform: `translate(${Math.round(x - s / 2)}px, ${Math.round(y - s / 2)}px)`,
        };
        const common = {
          'aria-label': target.ariaLabel,
          style,
          className: TARGET_CLASS,
          onClick: () => onTarget?.(target),
          onMouseEnter: () => onActive?.(target.id),
          onMouseLeave: () => onActive?.(null),
          onFocus: () => onActive?.(target.id),
          onBlur: () => onActive?.(null),
        };
        if (target.href && inRouter) return <Link key={target.id} to={target.href} {...common} />;
        if (target.href) return <a key={target.id} href={target.href} {...common} />;
        return <button key={target.id} type="button" {...common} />;
      })}
    </div>
  );
}
