// Swipe-left to delete on touch (§9.6). Pointer events only, no gesture library: a short swipe reveals a
// Delete button, a long one deletes straight away (the 5 s Undo snackbar is the safety net). Mouse pointers
// are ignored, and the same Delete lives in the entry's detail sheet, so nothing depends on the gesture.
import { useEffect, useRef, useState, type HTMLAttributes, type PointerEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const REVEAL = 88;
const SLOP = 8;

export interface SwipeRowProps extends Omit<HTMLAttributes<HTMLLIElement>, 'children'> {
  enabled: boolean;
  onDelete: () => void;
  /** 'Delete "Ramen Ichiran"' */
  deleteLabel: string;
  /** Classes for the sliding surface; give it the row's background so the red action stays hidden. */
  surfaceClassName?: string;
  children: ReactNode;
}

interface Gesture {
  id: number;
  x: number;
  y: number;
  base: number;
  axis: 'x' | 'y' | null;
}

export function SwipeRow({ enabled, onDelete, deleteLabel, surfaceClassName, className, children, ...rest }: SwipeRowProps) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [open, setOpen] = useState(false);
  const rowRef = useRef<HTMLLIElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const swallowClick = useRef(false);

  const close = () => {
    setOpen(false);
    setDx(0);
  };

  // Tap anywhere else closes a revealed row.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: globalThis.PointerEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!enabled || e.pointerType === 'mouse' || !e.isPrimary) return;
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, base: open ? -REVEAL : 0, axis: null };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || e.pointerId !== g.id) return;
    const mx = e.clientX - g.x;
    const my = e.clientY - g.y;
    if (!g.axis) {
      if (Math.abs(mx) < SLOP && Math.abs(my) < SLOP) return;
      g.axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
      if (g.axis === 'y') {
        gesture.current = null;
        return;
      }
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setDragging(true);
    }
    setDx(Math.min(0, g.base + mx));
  };

  const finish = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const g = gesture.current;
    if (!g || e.pointerId !== g.id) return;
    gesture.current = null;
    if (g.axis !== 'x') return;
    setDragging(false);
    swallowClick.current = true;
    window.setTimeout(() => {
      swallowClick.current = false;
    }, 0);
    const width = rowRef.current?.offsetWidth ?? 0;
    const far = Math.max(width * 0.5, 160);
    const end = Math.min(0, g.base + (e.clientX - g.x));
    if (cancelled) {
      if (open) setDx(-REVEAL);
      else close();
    } else if (-end >= far) {
      setDx(-Math.max(width, far));
      onDelete();
    } else if (-end >= REVEAL / 2) {
      setOpen(true);
      setDx(-REVEAL);
    } else {
      close();
    }
  };

  return (
    <li ref={rowRef} className={cn('relative overflow-hidden', className)} {...rest}>
      {enabled ? (
        <div
          className="absolute inset-y-0 right-0 flex bg-stamp-tint"
          style={{ width: Math.max(REVEAL, -dx) }}
          aria-hidden={open ? undefined : true}
        >
          <button
            type="button"
            tabIndex={open ? 0 : -1}
            onClick={onDelete}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
            }}
            aria-label={deleteLabel}
            className="type-label flex min-w-[88px] flex-1 items-center justify-end pr-5 font-semibold text-stamp"
          >
            Delete
          </button>
        </div>
      ) : null}
      <div
        className={cn('relative', surfaceClassName, !dragging && 'transition-transform duration-ui ease-out motion-reduce:transition-none')}
        style={{ transform: dx ? `translate3d(${dx}px,0,0)` : undefined, touchAction: enabled ? 'pan-y' : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => finish(e, false)}
        onPointerCancel={(e) => finish(e, true)}
        onClickCapture={(e) => {
          if (swallowClick.current) {
            e.preventDefault();
            e.stopPropagation();
          } else if (open) {
            // First tap on a revealed row just closes it.
            e.preventDefault();
            e.stopPropagation();
            close();
          }
        }}
      >
        {children}
      </div>
    </li>
  );
}
