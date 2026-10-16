// First run on Home (no trips at all): how a tabung works, as a ruled three-step list (not a card grid), and one
// primary button. Real numbers so it reads like a plan, not a pitch.
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STEPS = [
  {
    n: '01',
    word: 'ISI',
    title: 'Pick a place and set the jar',
    line: 'Tokyo, 9 days, RM 4,000. The jar fills to that, and we work out about RM 444 a day.',
  },
  {
    n: '02',
    word: 'JALAN',
    title: 'Log spends as you go',
    line: 'Paid ¥ 3,200 for ramen? Log it in yen; it comes out of the jar in ringgit.',
  },
  {
    n: '03',
    word: 'BALIK',
    title: 'Come home to a receipt',
    line: 'The trip gets its stamp, and whatever is left over shows as baki.',
  },
] as const;

export function FirstRun({ className }: { className?: string }) {
  return (
    <section aria-labelledby="first-run" className={cn('max-w-[640px]', className)}>
      <h2 id="first-run" className="type-display-3 text-ink">
        How a <em className="font-display italic">tabung</em> works
      </h2>
      <ol className="mt-4 border-t border-rule">
        {STEPS.map((s) => (
          <li key={s.n} className="grid grid-cols-[44px_1fr] gap-x-3 border-b border-rule py-4">
            <span className="font-mono text-[13px] font-medium leading-6 text-ink-3">{s.n}</span>
            <div>
              <p className="type-overline text-fund">{s.word}</p>
              <p className="type-title mt-0.5 text-ink">{s.title}</p>
              <p className="type-body-s mt-1 text-ink-2">{s.line}</p>
            </div>
          </li>
        ))}
      </ol>
      <Button asChild size="lg" className="mt-6">
        <Link to="/trips/new">
          <Plus aria-hidden="true" />
          Start a tabung
        </Link>
      </Button>
    </section>
  );
}
