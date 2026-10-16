// The Landing passbook: Tokyo autumn, RM 4,000, up to the evening of day 3. Yen spends are stored in ringgit
// at 32.41 (the §2.6 rule), so the BAKI after the last row is RM 2,788.00, the same RM 1,212 spent that the
// hero's JALAN act shows.
import type { PassbookRow } from '@/components/motifs/passbookMath';
import { CATEGORY_CODES } from '@/lib/categories';
import type { CategoryKey } from '@/design/tokens';

/** A passbook row plus its category, so the page can draw the glyph. */
export type DemoRow = PassbookRow & { category?: CategoryKey };

export const DEMO_PASSBOOK_TRIP = { start: '2026-11-12', end: '2026-11-20', budget: 4000, currency: 'MYR', days: 9 } as const;

function entry(id: string, date: string, label: string, cat: CategoryKey, myr: number, jpy?: number): DemoRow {
  return {
    id,
    date,
    label,
    out: myr,
    sub: CATEGORY_CODES[cat],
    category: cat,
    ...(jpy ? { originalAmount: jpy, originalCurrency: 'JPY' } : {}),
  };
}

/** Oldest first. The last row is a yen spend: both leader-line notes point at it. */
export const DEMO_PASSBOOK_ROWS: DemoRow[] = [
  { id: 'fund', date: '2026-10-01', label: 'Fund set', in: 4000, kind: 'system' },
  entry('hotel', '2026-10-02', 'Hotel Gracery Shinjuku', 'accommodation', 567.46),
  entry('skyliner', '2026-11-12', 'Skyliner to Ueno', 'transportation', 79.6, 2580),
  entry('teamlab', '2026-11-13', 'teamLab Planets', 'activities', 117.25, 3800),
  entry('ichiran', '2026-11-13', 'Ichiran Shinjuku', 'food', 98.73, 3200),
  entry('uniqlo', '2026-11-13', 'Uniqlo Ginza', 'shopping', 184.82, 5990),
  entry('nikko', '2026-11-14', 'Tobu line to Nikko', 'transportation', 83.92, 2720),
  entry('gyukatsu', '2026-11-14', 'Gyukatsu Motomura', 'food', 80.22, 2600),
];

/** Phones show the first five rows (§9.1); the fifth is a yen spend too. */
export const DEMO_PASSBOOK_ROWS_MOBILE = DEMO_PASSBOOK_ROWS.slice(0, 5);
