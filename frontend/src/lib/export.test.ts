import { describe, expect, it } from 'vitest';
import { csvCell, escapeHtml, generateTripPDFContent } from './export';
import type { Expense, Trip } from '@/types';

const trip: Trip = {
  id: 9,
  ownerId: 1,
  name: '<img src=x onerror=alert(1)> Tokyo',
  destinationCountry: 'JP',
  startDate: '2026-11-12',
  endDate: '2026-11-20',
  budget: 4000,
  currency: 'MYR',
  budgetType: 'solo',
  isArchived: false,
  createdAt: '2026-10-01T10:00:00',
  updatedAt: '2026-10-01T10:00:00',
};

const expense: Expense = {
  id: 1,
  tripId: 9,
  description: '"><script>steal()</script>',
  amount: 82.51,
  currency: 'MYR',
  originalAmount: 3200,
  originalCurrency: 'JPY',
  fxRate: 0.025784,
  category: 'food',
  expenseDate: '2026-11-14',
  notes: "it's <b>bold</b>",
  createdAt: '2026-11-14T21:04:00',
  updatedAt: '2026-11-14T21:04:00',
};

describe('escapeHtml', () => {
  it('escapes the five HTML specials', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
    expect(escapeHtml(null)).toBe('');
  });
});

describe('print report', () => {
  const html = generateTripPDFContent(trip, [expense]);
  it('contains no live markup from user text', () => {
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<b>bold</b>');
    expect(html).toContain('&lt;script&gt;steal()&lt;/script&gt;');
  });
  it('blocks scripts with a CSP and uses money formatting', () => {
    expect(html).toContain("default-src 'none'");
    expect(html).toContain('RM\u00A04,000.00');
    expect(html).toContain('¥\u00A03,200');
    expect(html).toContain('12–20 NOV 2026');
  });
});

describe('csvCell', () => {
  it('quotes every field and doubles quotes', () => {
    expect(csvCell('Nasi "lemak", pedas')).toBe('"Nasi ""lemak"", pedas"');
    expect(csvCell(undefined)).toBe('""');
  });
  it('defuses formula injection in text cells', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell('+60123')).toBe(`"'+60123"`);
    expect(csvCell('-2+3')).toBe(`"'-2+3"`);
    expect(csvCell('@SUM(A1)')).toBe(`"'@SUM(A1)"`);
    expect(csvCell('\tcmd')).toBe(`"'\tcmd"`);
  });
  it('leaves our own numbers alone', () => {
    expect(csvCell('-12.50', { numeric: true })).toBe('"-12.50"');
  });
});
