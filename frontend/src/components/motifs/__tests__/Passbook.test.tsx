import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Passbook } from '@/components/motifs/Passbook';
import { computePassbook, groupPassbookDays, tripDayOf, type PassbookRow } from '@/components/motifs/passbookMath';

const nb = (s: string | null | undefined) => (s ?? '').replace(/\u00A0/g, ' ');

const rows: PassbookRow[] = [
  { id: 'fund', date: '2026-09-01', label: 'Fund set', in: 4000, kind: 'system' },
  { id: 1, date: '2026-09-20', label: 'Flights KUL to HND', out: 1240 },
  { id: 2, date: '2026-11-12', label: 'Hotel Gracery', out: 720 },
  { id: 3, date: '2026-11-12', label: 'Suica top-up', out: 89.1, originalAmount: 3000, originalCurrency: 'JPY' },
  { id: 4, date: '2026-11-13', label: 'Ramen Ichiran', out: 94.4 },
];

describe('computePassbook', () => {
  it('runs BAKI oldest first from the FUND SET row (Phase A)', () => {
    expect(computePassbook(rows, 0, 'MYR').map((l) => l.balance)).toEqual([4000, 2760, 2040, 1950.9, 1856.5]);
  });

  it('saving mode: fund entries are MASUK rows between spends', () => {
    const saving: PassbookRow[] = [
      { id: 'a', date: '2026-10-02', label: 'Dropped in', in: 1500 },
      { id: 'b', date: '2026-10-12', label: 'Flights', out: 2400 },
      { id: 'c', date: '2026-10-14', label: 'Dropped in', in: 1500 },
    ];
    expect(computePassbook(saving).map((l) => l.balance)).toEqual([1500, -900, 600]);
  });

  it('starts from an opening balance and never drifts on cents', () => {
    const many: PassbookRow[] = Array.from({ length: 100 }, (_, i) => ({ id: i, date: '2026-11-12', label: 'Teh tarik', out: 0.1 }));
    const lines = computePassbook(many, 50, 'MYR');
    expect(lines[lines.length - 1].balance).toBe(40);
  });

  it('goes negative past the budget', () => {
    const over = computePassbook([{ id: 1, date: '2026-11-10', label: 'Fund set', in: 100 }, { id: 2, date: '2026-11-10', label: 'Hotel', out: 340 }]);
    expect(over[1].balance).toBe(-240);
  });
});

describe('groupPassbookDays / tripDayOf', () => {
  it('groups consecutive dates and sums the day spend', () => {
    const days = groupPassbookDays(computePassbook(rows), 'MYR');
    expect(days.map((d) => [d.date, d.spent])).toEqual([
      ['2026-09-01', 0],
      ['2026-09-20', 1240],
      ['2026-11-12', 809.1],
      ['2026-11-13', 94.4],
    ]);
  });

  it('numbers trip days and marks dates outside the trip', () => {
    expect(tripDayOf('2026-11-12', '2026-11-12', '2026-11-20')).toBe(1);
    expect(tripDayOf('2026-11-14', '2026-11-12', '2026-11-20')).toBe(3);
    expect(tripDayOf('2026-09-20', '2026-11-12', '2026-11-20')).toBe('before');
    expect(tripDayOf('2026-11-21', '2026-11-12', '2026-11-20')).toBe('after');
    expect(tripDayOf('2026-11-14')).toBeNull();
  });
});

describe('<Passbook>', () => {
  it('table: bilingual headers, the running BAKI in each row, a negative BAKI marked over', () => {
    render(
      <Passbook
        layout="table"
        caption="Tokyo autumn ledger"
        currency="MYR"
        rows={[...rows, { id: 5, date: '2026-11-14', label: 'Uniqlo Ginza', out: 2000 }]}
        tripStart="2026-11-12"
        tripEnd="2026-11-20"
        dailyAllowance={444.44}
      />,
    );
    const table = screen.getByRole('table', { name: 'Tokyo autumn ledger' });
    for (const name of ['Date', 'Details', 'Out', 'In', 'Balance']) {
      expect(within(table).getByRole('columnheader', { name })).toBeInTheDocument();
    }
    const ramen = screen.getByText('Ramen Ichiran').closest('tr')!;
    expect(nb(ramen.textContent)).toContain('RM 1,856.50');
    const uniqlo = screen.getByText('Uniqlo Ginza').closest('tr')!;
    expect(nb(uniqlo.textContent)).toContain('−RM 143.50');
    expect(within(uniqlo).getByText('over')).toBeInTheDocument();
    // foreign row: what was paid, then ≈ the trip-currency amount
    const suica = screen.getByText('Suica top-up').closest('tr')!;
    expect(nb(suica.textContent)).toContain('¥ 3,000');
    expect(nb(suica.textContent)).toContain('≈ RM 89.10');
    // day headers: trip day numbers, pre-trip bookings, and over-allowance only on trip days
    expect(screen.getByText(/^DAY 1 · THU 12 NOV/)).toBeInTheDocument();
    expect(nb(screen.getByText(/^BEFORE THE TRIP · SUN 20 SEP/).textContent)).not.toContain('over today');
    expect(nb(screen.getByText(/^DAY 1 · THU 12 NOV/).textContent)).toContain('RM 365 over today');
  });

  it('list: two-line rows with sr-only labels, newest first keeps the oldest-first balance', () => {
    render(<Passbook layout="list" currency="MYR" rows={rows} newestFirst groupByDay={false} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Ramen Ichiran');
    expect(nb(items[0].textContent)).toContain('BAKI RM 1,856.50');
    expect(nb(items[items.length - 1].textContent)).toContain('+RM 4,000.00');
    expect(within(items[0]).getByText(/balance/i)).toHaveClass('sr-only');
  });

  it('row click opens the entry; bundles expand', () => {
    const onRowClick = vi.fn();
    render(
      <Passbook
        layout="list"
        currency="MYR"
        onRowClick={onRowClick}
        rows={[{ id: 9, date: '2026-11-12', label: 'Hotel', out: 480, isBundle: true, children: [{ id: 'a', label: 'Night 1', amount: 240 }, { id: 'b', label: 'Night 2', amount: 240 }] }]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Hotel' }));
    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ id: 9, balance: -480 }));
    expect(screen.queryByText('Night 1')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show 2 items in Hotel' }));
    expect(screen.getByText('Night 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide 2 items in Hotel' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('prints only rows added after the first render', () => {
    const { rerender, container } = render(<Passbook layout="list" currency="MYR" rows={rows.slice(0, 2)} groupByDay={false} />);
    expect(container.querySelectorAll('.animate-print-in')).toHaveLength(0);
    rerender(<Passbook layout="list" currency="MYR" rows={rows.slice(0, 3)} groupByDay={false} />);
    const fresh = container.querySelectorAll('.animate-print-in');
    expect(fresh).toHaveLength(1);
    expect(fresh[0]).toHaveTextContent('Hotel Gracery');
  });

  it('empty ledger says so', () => {
    render(<Passbook currency="MYR" rows={[]} />);
    expect(screen.getByText('Nothing in the ledger yet. The first teh tarik counts too.')).toBeInTheDocument();
  });
});
