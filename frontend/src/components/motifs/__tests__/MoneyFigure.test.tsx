import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MoneyFigure } from '@/components/motifs/MoneyFigure';
import { phaseTagPropsFor, phaseTagText, routeLabel, ticketFieldRow } from '@/components/motifs/tripMeta';

const nb = (s: string | null | undefined) => (s ?? '').replace(/\u00A0/g, ' ');

describe('MoneyFigure', () => {
  it('hero: small prefix, big integer, small decimals, one spoken string', () => {
    const { container } = render(<MoneyFigure size="hero" amount={2340.5} currency="MYR" />);
    expect(nb(container.querySelector('.sr-only')?.textContent)).toBe('RM 2,340.50');
    expect(screen.getByText('2,340')).toBeInTheDocument();
    expect(screen.getByText('.50')).toBeInTheDocument();
  });

  it('stamp tone appends "over" to a negative amount', () => {
    const { container } = render(<MoneyFigure size="hero" amount={-240} currency="MYR" tone="stamp" />);
    expect(nb(container.querySelector('.sr-only')?.textContent)).toBe('−RM 240.00 over');
    render(<MoneyFigure size="l" amount={-82.5} currency="SGD" tone="stamp" />);
    expect(screen.getAllByText('over').length).toBeGreaterThan(0);
  });

  it('ledger and l sizes print the full figure', () => {
    render(<MoneyFigure size="ledger" amount={3200} currency="JPY" approx />);
    expect(nb(screen.getByText(/3,200/).textContent)).toBe('≈ ¥ 3,200');
  });
});

describe('tripMeta', () => {
  const tokyo = { startDate: '2026-11-12', endDate: '2026-11-20', destinationCountry: 'JP' };

  it('phase tag text for each phase', () => {
    expect(phaseTagText(phaseTagPropsFor(tokyo, new Date(2026, 9, 15))).text).toBe('UPCOMING · 28 DAYS');
    expect(phaseTagText(phaseTagPropsFor(tokyo, new Date(2026, 10, 14))).text).toBe('ON THE ROAD · DAY 3/9');
    expect(phaseTagText(phaseTagPropsFor(tokyo, new Date(2026, 10, 25))).text).toBe('HOME · 20 NOV');
    expect(phaseTagText({ phase: 'upcoming', daysToGo: 1, saving: true })).toEqual({ text: 'SAVING · 1 DAY', spoken: 'Saving, 1 day to go' });
  });

  it('field row and route', () => {
    expect(ticketFieldRow(tokyo, 'MY', new Date(2026, 9, 15))).toBe('MY → JP · 12–20 NOV · 9D8N');
    expect(ticketFieldRow(tokyo, null, new Date(2025, 9, 15))).toBe('JP · 12–20 NOV 2026 · 9D8N');
    expect(routeLabel('MY', 'MY')).toBe('MY');
  });
});
