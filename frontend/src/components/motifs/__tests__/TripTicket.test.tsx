import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Trip } from '@/types';
import { TripTicket } from '@/components/motifs/TripTicket';
import { LedgerTabs } from '@/components/motifs/LedgerTabs';
import { DivergingBar } from '@/components/motifs/DivergingBar';
import { NoticeSlip } from '@/components/motifs/NoticeSlip';
import { MiniBalangSvg } from '@/iso/svg/MiniBalangSvg';

const nb = (s: string | null | undefined) => (s ?? '').replace(/\u00A0/g, ' ');

const tokyo: Trip = {
  id: 1,
  ownerId: 1,
  name: 'Tokyo autumn',
  destinationCountry: 'JP',
  startDate: '2026-11-12',
  endDate: '2026-11-20',
  budget: 4000,
  currency: 'MYR',
  budgetType: 'solo',
  isArchived: false,
  createdAt: '2026-09-01T10:00:00',
  updatedAt: '2026-09-01T10:00:00',
  totalExpenses: 1660,
};

const inRouter = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('TripTicket', () => {
  it('list: phase tag, field row, rail and practical line; the menu is always there', () => {
    const onEdit = vi.fn();
    inRouter(<TripTicket trip={tokyo} homeCountry="MY" today={new Date(2026, 10, 14)} to="/trips/1" onEdit={onEdit} onDelete={() => {}} />);
    expect(screen.getByRole('link', { name: 'Tokyo autumn' })).toHaveAttribute('href', '/trips/1');
    expect(screen.getByText('On the road, day 3 of 9')).toBeInTheDocument();
    expect(screen.getByText('MY → JP · 12–20 NOV · 9D8N')).toBeInTheDocument();
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '2340');
    expect(nb(screen.getByText(/a day for the next/).textContent)).toBe('≈ RM 334 a day for the next 7 days.');
    const more = screen.getByRole('button', { name: 'More for Tokyo autumn' });
    expect(more.className).not.toMatch(/opacity-0/);
    expect(more.className).toMatch(/h-11 w-11/);
  });

  it('home trips carry an earned BALIK stamp; group trips the airmail stripe', () => {
    const { container } = inRouter(
      <TripTicket trip={{ ...tokyo, budgetType: 'shared', memberCount: 3, totalExpenses: 3688 }} today={new Date(2026, 10, 25)} />,
    );
    expect(screen.getByRole('img', { name: 'BALIK stamp, 20 Nov' })).toBeInTheDocument();
    expect(container.querySelector('[style*="repeating-linear-gradient(-45deg"]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /More for/ })).toBeNull(); // no actions given → no menu
  });

  it('hero before the trip: countdown flap and the four ticket fields', () => {
    inRouter(<TripTicket variant="hero" trip={{ ...tokyo, totalExpenses: 0 }} homeCountry="MY" today={new Date(2026, 9, 15)} />);
    expect(screen.getByRole('img', { name: '28 days' })).toBeInTheDocument();
    for (const label of ['From/To', 'Depart', 'Days', 'Fund']) expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText('9D8N')).toBeInTheDocument();
    expect(nb(screen.getByText(/4,000$/).textContent)).toBe('RM 4,000');
  });

  it('review has no menu and no link even with handlers', () => {
    inRouter(<TripTicket variant="review" trip={{ ...tokyo, id: undefined }} today={new Date(2026, 9, 15)} onEdit={() => {}} />);
    expect(screen.queryByRole('button', { name: /More for/ })).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('RM 444 a day planned.')).toBeInTheDocument();
  });

  it('mini: title, maps link for the location', () => {
    inRouter(<TripTicket variant="mini" title="teamLab Planets" location="Toyosu, Tokyo" onDelete={() => {}} />);
    const link = screen.getByRole('link', { name: /Toyosu, Tokyo/ });
    expect(link).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=Toyosu%2C%20Tokyo');
    expect(screen.getByRole('button', { name: 'More for teamLab Planets' })).toBeInTheDocument();
  });
});

describe('LedgerTabs', () => {
  it('is a tablist with arrow-key navigation and counts', () => {
    const onChange = vi.fn();
    render(
      <LedgerTabs
        ariaLabel="Filter trips"
        value="all"
        onChange={onChange}
        idBase="trips"
        tabs={[
          { key: 'all', label: 'All', count: 7 },
          { key: 'road', label: 'On the road', count: 1 },
        ]}
      />,
    );
    const list = screen.getByRole('tablist', { name: 'Filter trips' });
    const [all, road] = within(list).getAllByRole('tab');
    expect(all).toHaveAttribute('aria-selected', 'true');
    expect(all).toHaveAttribute('aria-controls', 'trips-panel-all');
    expect(road).toHaveAttribute('tabindex', '-1');
    expect(road).toHaveTextContent('On the road1');
    fireEvent.keyDown(all, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('road');
    fireEvent.keyDown(all, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('road');
    fireEvent.click(road);
    expect(onChange).toHaveBeenLastCalledWith('road');
  });
});

describe('DivergingBar / NoticeSlip / MiniBalangSvg', () => {
  it('Kongsi rows say who owes in words, not only colour', () => {
    render(
      <DivergingBar
        currency="MYR"
        rows={[
          { name: 'Aiman', net: 82.5 },
          { name: 'Siti', net: -82.5 },
          { name: 'Hafiz', net: 0 },
        ]}
      />,
    );
    expect(nb(screen.getByText(/^Aiman is owed/).textContent)).toBe('Aiman is owed RM 82.50');
    expect(nb(screen.getByText(/^Siti owes/).textContent)).toBe('Siti owes RM 82.50');
    expect(screen.getByText('Hafiz is square')).toBeInTheDocument();
  });

  it('NoticeSlip is a status with a 44px dismiss', () => {
    const onDismiss = vi.fn();
    render(
      <NoticeSlip level="over" onDismiss={onDismiss}>
        Over by RM 240. Happens.
      </NoticeSlip>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Over budget: Over by RM 240. Happens.');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notice' }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('MiniBalangSvg: named when titled, decorative otherwise', () => {
    const { container } = render(<MiniBalangSvg fill={0.585} phase="onTheRoad" title="Jar 58% full" theme="light" />);
    expect(screen.getByRole('img', { name: 'Jar 58% full' })).toHaveAttribute('width', '44');
    render(<MiniBalangSvg fill={0} over theme="dark" />);
    expect(container.ownerDocument.querySelectorAll('svg[aria-hidden="true"]').length).toBeGreaterThan(0);
  });
});
