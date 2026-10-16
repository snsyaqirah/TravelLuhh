// Landing hero scene (§9.1): the S2 TripPlot demo, Tokyo autumn · 9D8N · RM 4,000, through three acts.
// Acts advance every 6s until the first interaction; under reduced motion it rests on act 3's final frame.
// The 3D loads lazily inside IsoStage (its SVG twin paints first), so nothing here imports three.
import { useMemo } from 'react';
import { IsoStage } from '@/iso/IsoStage';
import { useReducedMotion } from '@/iso/hooks';
import { DEMO_TRIP, useTripPlotDemo, type DemoAct } from '@/iso/mappers/tripPlot';
import { PassportStamp } from '@/components/motifs/PassportStamp';
import { useMediaQuery } from '@/components/shell/useMediaQuery';
import { cn } from '@/lib/utils';

export function HeroDemo({ className }: { className?: string }) {
  const demo = useTripPlotDemo();
  const reduced = useReducedMotion();
  const desktop = useMediaQuery('(min-width: 1024px)');

  // Act 3 earns a real BALIK stamp (DOM, over the signpost); the signpost label goes back to the route.
  const spec = useMemo(() => {
    const s = demo.spec;
    if (!s.stamp) return s;
    return {
      ...s,
      labels: s.labels.map((l) => (l.id === 'sign' ? { ...l, text: l.sub ?? 'MY → JP', sub: undefined, tone: 'ink' as const } : l)),
    };
  }, [demo.spec]);
  const stamp = spec.stamp;

  return (
    <figure
      className={cn('flex flex-col', className)}
      // Any touch or key inside the hero counts as "I'm looking now": stop turning the pages.
      onPointerDownCapture={demo.stop}
      onKeyDownCapture={demo.stop}
    >
      <div className="border border-rule bg-leaf">
        <IsoStage
          spec={spec}
          mode="demo"
          height={{ base: 300, lg: 560 }}
          footer={null}
          overlay={
            stamp
              ? (project) => {
                  const [x, y] = project(stamp.at);
                  return (
                    <div className="absolute" style={{ left: x, top: y, transform: 'translate(-30%, -105%)' }}>
                      <PassportStamp
                        text="BALIK"
                        code={DEMO_TRIP.destinationCountry}
                        date={DEMO_TRIP.endDate}
                        region="asia"
                        seed="landing-demo"
                        size={desktop ? 96 : 64}
                        animate={!reduced}
                        decorative
                      />
                    </div>
                  );
                }
              : undefined
          }
        />
      </div>

      <figcaption className="mt-3">
        <div role="group" aria-label="The three acts of a tabung" className="grid grid-cols-3 border border-rule-strong bg-leaf">
          {demo.acts.map((a) => {
            const [num, key, ...rest] = a.chip.split(' ');
            const active = a.act === demo.act;
            return (
              <button
                key={a.act}
                type="button"
                aria-pressed={active}
                onClick={() => demo.select(a.act as DemoAct)}
                className={cn(
                  'flex min-h-12 flex-col items-start justify-center gap-0.5 px-3 py-2 text-left font-mono transition-colors duration-micro sm:flex-row sm:items-baseline sm:gap-2',
                  'border-l border-rule-strong first:border-l-0',
                  active ? 'bg-ink text-paper' : 'text-ink hover:bg-sunken',
                )}
              >
                <span className="text-[12px] font-semibold uppercase leading-4 tracking-[0.08em]">
                  <span className={active ? 'opacity-70' : 'text-ink-3'}>{num}</span> {key}
                </span>
                <span className={cn('text-[12px] leading-4', active ? 'opacity-80' : 'text-ink-2')}>{rest.join(' ')}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex min-h-11 items-center justify-between gap-3">
          <p className="type-ledger text-ink" aria-live={demo.auto ? 'off' : 'polite'}>
            {demo.caption}
          </p>
          {demo.auto ? (
            <button
              type="button"
              onClick={demo.stop}
              className="type-body-s inline-flex min-h-11 shrink-0 items-center text-ink-2 underline decoration-rule-strong underline-offset-[3px] hover:text-ink hover:decoration-ink"
            >
              Pause
            </button>
          ) : null}
        </div>
      </figcaption>
    </figure>
  );
}
