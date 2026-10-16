// EMAIL ── VERIFY ── PROFILE (§9.2): Plex Mono labels, filled dots for done and current steps, joined by a
// perforated line that inks in fund once the step before it is done.
import { Fragment } from 'react';
import { cn } from '@/lib/utils';

export interface ProgressStripProps {
  steps: readonly string[];
  /** 0-based index of the current step. */
  current: number;
  className?: string;
}

function Dot({ state }: { state: 'done' | 'current' | 'todo' }) {
  return (
    <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" className="shrink-0">
      {state === 'todo' ? (
        <circle cx="5" cy="5" r="3.75" fill="none" stroke="hsl(var(--ink-3))" strokeWidth="1.5" />
      ) : (
        <circle cx="5" cy="5" r="4.5" fill={state === 'done' ? 'hsl(var(--fund))' : 'hsl(var(--ink))'} />
      )}
    </svg>
  );
}

export function ProgressStrip({ steps, current, className }: ProgressStripProps) {
  return (
    <>
      <p className="sr-only" aria-live="polite">
        {current < steps.length ? `Step ${current + 1} of ${steps.length}: ${steps[current].toLowerCase()}` : ''}
      </p>
      <ol
        aria-label="Steps"
        className={cn('flex w-full items-center font-mono text-[11px] font-medium uppercase leading-[14px] tracking-[0.08em]', className)}
      >
        {steps.map((label, i) => {
          const state = i < current ? 'done' : i === current ? 'current' : 'todo';
          return (
            <Fragment key={label}>
              {i > 0 ? (
                <li aria-hidden="true" className="mx-2 flex min-w-4 flex-1 items-center">
                  <svg className="h-0.5 w-full" preserveAspectRatio="none">
                    <line
                      x1="0"
                      y1="1"
                      x2="100%"
                      y2="1"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                      stroke={i <= current ? 'hsl(var(--fund))' : 'hsl(var(--rule-strong))'}
                    />
                  </svg>
                </li>
              ) : null}
              <li aria-current={state === 'current' ? 'step' : undefined} className="flex shrink-0 items-center gap-1.5">
                <Dot state={state} />
                <span className={state === 'todo' ? 'text-ink-3' : 'text-ink'}>{label}</span>
                <span className="sr-only">{state === 'done' ? ', done' : state === 'current' ? ', current step' : ', not yet'}</span>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </>
  );
}
