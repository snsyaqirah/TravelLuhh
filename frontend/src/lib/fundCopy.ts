// Sentences about a jar, from a FundState (copy voice §11). Pure, so tickets, figures, notices and scene
// summaries all say the same thing.
import type { FundState } from '@/hooks/useFund';
import { formatMoney } from '@/lib/money';

/** Sentence money: whole units from 100 up ('RM 312'), cents below ('RM 82.50'). */
export function sentenceMoney(amount: number, currency: string, o: { approx?: boolean } = {}): string {
  return formatMoney(amount, currency, { approx: o.approx, decimals: Math.abs(amount) >= 100 ? 'none' : undefined });
}

function days(n: number): string {
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}

/**
 * The practical line under the figures:
 * on the road '≈ RM 312 a day for the next 7 days.' · upcoming 'RM 444 a day planned.' ·
 * home 'Back with RM 312 baki.' / 'Over by RM 240.' · no budget 'No budget set for this trip. Add one to fill the jar.'
 */
export function practicalLine(f: FundState): string {
  const c = f.currency;
  if (f.phase === 'home') {
    if (f.over > 0) return `Over by ${sentenceMoney(f.over, c)}.`;
    return f.hasBudget || f.saved > 0 ? `Back with ${sentenceMoney(f.inJar, c)} baki.` : 'Back home.';
  }
  if (!f.hasBudget && f.saved <= 0) return 'No budget set for this trip. Add one to fill the jar.';
  if (f.phase === 'upcoming') {
    return f.dailyAllowance != null ? `${sentenceMoney(f.dailyAllowance, c)} a day planned.` : '';
  }
  if (f.over > 0 || f.inJar <= 0) return `Over by ${sentenceMoney(f.over, c)}.`;
  const a = sentenceMoney(f.dailyAllowance ?? 0, c, { approx: true });
  return f.daysLeft <= 1 ? `${a} left for today.` : `${a} a day for the next ${days(f.daysLeft)}.`;
}

/**
 * Pace sentence (on the road, with a budget):
 * 'On pace. RM 140 under so far.' or 'At this pace you'll land at RM 4,420, about RM 420 over.'
 */
export function paceSentence(f: FundState): string | null {
  if (!f.pace || !f.hasBudget || f.daysTotal <= 0) return null;
  const c = f.currency;
  if (f.pace.delta > 0.5) {
    return `At this pace you'll land at ${sentenceMoney(f.pace.projected, c)}, about ${sentenceMoney(f.pace.delta, c)} over.`;
  }
  const expectedSoFar = (f.target * f.daysElapsed) / f.daysTotal;
  const under = Math.max(0, expectedSoFar - f.spent);
  return under >= 1 ? `On pace. ${sentenceMoney(under, c)} under so far.` : 'On pace.';
}

export type NoticeLevel = 'over' | 'warn' | 'info';

export interface FundNotice {
  /** Stable per threshold, for session dismissal: 'over' | 'p90' | 'p75' | 'nobudget'. */
  id: 'over' | 'p90' | 'p75' | 'nobudget';
  level: NoticeLevel;
  text: string;
}

/** The one highest-severity notice for the NoticeSlip, or null. Thresholds 75 / 90 / 100 % of the target. */
export function fundNotice(f: FundState): FundNotice | null {
  const c = f.currency;
  if (!f.hasBudget) {
    return f.phase === 'home' ? null : { id: 'nobudget', level: 'info', text: 'No budget set for this trip. Add one to fill the jar.' };
  }
  if (f.over > 0) {
    return { id: 'over', level: 'over', text: `Over by ${sentenceMoney(f.over, c)}. Happens. Here's where it went →` };
  }
  if (f.phase === 'home') return null;
  const left = Math.max(0, f.target - f.spent);
  if (f.usedRatio >= 0.9) {
    const text = f.phase === 'onTheRoad' ? `${sentenceMoney(left, c)} left for ${days(f.daysLeft)}.` : `${sentenceMoney(left, c)} left in the jar.`;
    return { id: 'p90', level: 'warn', text };
  }
  if (f.usedRatio >= 0.75) {
    const text =
      f.phase === 'onTheRoad'
        ? `Three quarters gone, ${days(f.daysLeft)} left. Still okay if you slow down a bit.`
        : 'Three quarters gone before the trip starts.';
    return { id: 'p75', level: 'warn', text };
  }
  return null;
}

/** Kongsi row: 'Aiman → Siti · RM 82.50' (exact cents: people transfer this amount). */
export function transferLine(t: { fromName: string; toName: string; amount: number }, currency: string): string {
  return `${t.fromName} → ${t.toName} · ${formatMoney(t.amount, currency)}`;
}

/**
 * "Copy for WhatsApp" plain text:
 * 'Tokyo autumn settle-up\nAiman → Siti RM 82.50\n…', or the all-square line when nobody owes anything.
 * Regular spaces only, so it pastes cleanly into any chat app.
 */
export function settleUpText(
  tripName: string,
  transactions: { fromName: string; toName: string; amount: number }[],
  currency: string
): string {
  const lines = transactions.map(
    (t) => `${t.fromName} → ${t.toName} ${formatMoney(t.amount, currency).replace(/\u00A0/g, ' ')}`
  );
  return [`${tripName} settle-up`, ...(lines.length ? lines : ['All square. Nobody owes anybody.'])].join('\n');
}
