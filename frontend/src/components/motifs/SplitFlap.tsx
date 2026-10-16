// Departures-board digits (§5.4). Only two uses: the countdown days and the OTP cells (ui/input-otp has the
// same cell look). When a character changes, only its cell flips down (rotateX 90° → 0, 120 ms, 30 ms
// stagger). First paint and reduced motion show the value settled.
import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { motion as motionTokens, easingCurve } from '@/design/tokens';
import { cn } from '@/lib/utils';

export interface SplitFlapProps {
  value: string | number;
  /** Shown after the cells as an overline and read with the value: "28 days". */
  label?: string;
  /** Accessible text when the label alone would read oddly (default: `${value} ${label}`). */
  ariaLabel?: string;
  className?: string;
  /** Font size of the digits (cells are 0.72em × 1.1em of it). Default 40px. */
  size?: number;
}

const STAGGER_S = 0.03;

export function SplitFlap({ value, label, ariaLabel, className, size = 40 }: SplitFlapProps) {
  const text = String(value);
  const chars = Array.from(text);
  const reduce = useReducedMotion();
  const prev = useRef<string[] | null>(null);
  const previous = prev.current;
  useEffect(() => {
    prev.current = chars;
  });

  return (
    <span
      role="img"
      aria-label={ariaLabel ?? (label ? `${text} ${label.toLowerCase()}` : text)}
      className={cn('inline-flex items-end gap-2', className)}
    >
      <span className="inline-flex gap-0.5" style={{ fontSize: size }}>
        {chars.map((ch, i) => {
          const changed = previous !== null && previous[i] !== ch;
          return (
            <span
              key={i}
              className="relative inline-flex h-[1.1em] w-[0.72em] items-center justify-center overflow-hidden rounded-sm bg-ink [perspective:4em] dark:bg-shade"
            >
              <motion.span
                // A new key per character remounts the flap, so only changed cells animate.
                key={`${i}-${ch}`}
                initial={changed && !reduce ? { rotateX: 90 } : false}
                animate={{ rotateX: 0 }}
                transition={{
                  duration: motionTokens.micro / 1000,
                  delay: i * STAGGER_S,
                  ease: easingCurve.out,
                }}
                className="font-mono font-semibold leading-none text-leaf [transform-origin:50%_50%] dark:text-ink"
              >
                {ch === ' ' ? '\u00A0' : ch}
              </motion.span>
              {/* the split between the two flaps */}
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-paper/40 dark:bg-ink/20" />
            </span>
          );
        })}
      </span>
      {label ? (
        <span aria-hidden="true" className="type-overline pb-1 text-ink-2">
          {label}
        </span>
      ) : null}
    </span>
  );
}
