// Logbook (§9.6, ?sheet=logbook): everything people changed on the trip, as departure-board rows grouped by
// day. Mono time, the server's sentence (it already starts with who did it), and a board code for the part of
// the trip it touched. Bottom sheet on phones, right drawer from 768px. Fetches only while open.
import { useMemo } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useActivity } from '@/hooks/useActivity';
import { useMediaQuery } from '@/components/shell/useMediaQuery';
import { cn } from '@/lib/utils';
import { LOG_CODE_LABEL, groupLogbook, splitAmounts, type LogLine } from '@/components/activity/logbook';

export interface LogbookSheetProps {
  tripId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Sentence({ line }: { line: LogLine }) {
  const { actorName, description } = line.activity;
  // Bold the actor when the sentence starts with their name (it always should).
  const lead = actorName && description.startsWith(actorName) ? actorName : '';
  const rest = lead ? description.slice(lead.length) : description;
  return (
    <p className="type-body-s min-w-0 break-words text-ink">
      {lead ? <span className="font-semibold">{lead}</span> : null}
      {splitAmounts(rest).map((part, i) =>
        part.money ? (
          <span key={i} className="whitespace-nowrap font-mono text-[13px]">
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </p>
  );
}

function LogbookSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-5 px-5 py-4">
      {[5, 3].map((n, i) => (
        <div key={i}>
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-3" style={{ height: n * 48, ['--ledger-row' as string]: '48px' }} />
        </div>
      ))}
    </div>
  );
}

export function LogbookSheet({ tripId, open, onOpenChange }: LogbookSheetProps) {
  const wide = useMediaQuery('(min-width: 768px)');
  const { activities, isLoading, error, refetch } = useActivity(tripId, { enabled: open });
  const days = useMemo(() => groupLogbook(activities), [activities]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={wide ? 'right' : 'bottom'}
        className={cn('flex flex-col gap-0 p-0', wide ? 'w-full sm:max-w-[440px]' : 'h-[88dvh] max-h-[88dvh]')}
      >
        <SheetHeader className="border-b border-rule px-5 pb-4 pt-5">
          <p className="type-overline text-ink-2">Departures · arrivals · changes</p>
          <SheetTitle>Logbook</SheetTitle>
          <SheetDescription>Every change to this trip, newest first.</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          {isLoading ? (
            <LogbookSkeleton />
          ) : error && !activities.length ? (
            <div role="alert" className="m-5 border-l-[3px] border-stamp bg-stamp-tint px-4 py-3">
              <p className="type-body text-ink">{error}</p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => void refetch()}>
                Try again
              </Button>
            </div>
          ) : !days.length ? (
            <div className="px-5 py-8">
              <p className="type-body text-ink">Nothing logged yet.</p>
              <p className="type-body-s mt-1 text-ink-2">Spends, stops, packed bags and notes show up here as people add them.</p>
            </div>
          ) : (
            <div className="pb-6">
              {days.map((day) => (
                <section key={day.iso} aria-labelledby={`log-${day.iso}`}>
                  <h3
                    id={`log-${day.iso}`}
                    className="sticky top-0 z-[1] flex items-center justify-between border-b border-rule bg-sunken px-5 py-2"
                  >
                    <span className="type-overline text-ink">{day.label}</span>
                    <span className="font-mono text-[11px] text-ink-2">
                      {day.lines.length} {day.lines.length === 1 ? 'entry' : 'entries'}
                    </span>
                  </h3>
                  <ol>
                    {day.lines.map((line) => (
                      <li
                        key={line.activity.id}
                        className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-start gap-x-3 border-b border-rule px-5 py-3 even:bg-stripe"
                      >
                        <time
                          dateTime={line.activity.createdAt}
                          className="pt-px font-mono text-[13px] font-medium leading-5 text-ink"
                        >
                          {line.time}
                        </time>
                        <Sentence line={line} />
                        <span className="mt-0.5 border border-rule-strong px-1 py-px font-mono text-[10px] font-medium leading-4 tracking-[0.08em] text-ink-2">
                          <span aria-hidden="true">{line.code}</span>
                          <span className="sr-only">{LOG_CODE_LABEL[line.code]}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
              {activities.length >= 100 ? (
                <p className="type-body-s px-5 pt-4 text-ink-2">Showing the latest 100 changes.</p>
              ) : null}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
