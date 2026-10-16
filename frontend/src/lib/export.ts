// CSV and print exports. Everything a person typed (trip names, descriptions, notes) is untrusted:
// HTML-escaped in the print report and guarded against formula injection in CSV.
import { format } from 'date-fns';
import type { Expense, Trip } from '@/types';
import { getCountryByCode } from '@/data/countries';
import { categoryLabel } from '@/lib/categories';
import { currencyDecimals, formatMoney } from '@/lib/money';
import { formatRange, isValidDate, parseLocalDate } from '@/lib/dates';
import { light } from '@/design/tokens';

// ── Escaping ────────────────────────────────────────────────────────────────

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/**
 * One CSV field, always quoted. Text that a spreadsheet would run as a formula (= + - @, tab, CR) gets a
 * leading apostrophe. Plain numbers we generate ourselves pass `{ numeric: true }` and stay numbers.
 */
export function csvCell(value: unknown, o: { numeric?: boolean } = {}): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (!o.numeric && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function csvRow(cells: string[]): string {
  return cells.join(',');
}

function plainAmount(amount: number, currency: string): string {
  const n = Number(amount);
  return Number.isFinite(n) ? n.toFixed(currencyDecimals(currency)) : '';
}

function isoDay(value: string): string {
  const d = parseLocalDate(value);
  return isValidDate(d) ? format(d, 'yyyy-MM-dd') : '';
}

function safeFilename(name: string): string {
  const base = name.trim().replace(/[^\w-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return base || 'travelluhh';
}

function countryName(code: string): string {
  return getCountryByCode(code)?.name ?? code;
}

function sumSpent(expenses: Expense[]): number {
  return expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
}

// ── CSV ─────────────────────────────────────────────────────────────────────

const EXPENSE_HEADERS = ['Date', 'Category', 'Description', 'Amount', 'Currency', 'Paid', 'Paid currency', 'Paid by', 'Notes'];

function expenseRow(e: Expense): string {
  const originalCurrency = e.originalCurrency || e.currency;
  return csvRow([
    csvCell(isoDay(e.expenseDate)),
    csvCell(categoryLabel(e.category)),
    csvCell(e.description),
    csvCell(plainAmount(e.amount, e.currency), { numeric: true }),
    csvCell(e.currency),
    csvCell(plainAmount(e.originalAmount ?? e.amount, originalCurrency), { numeric: true }),
    csvCell(originalCurrency),
    csvCell(e.paidByUser?.name ?? e.addedByUser?.name ?? ''),
    csvCell(e.notes ?? ''),
  ]);
}

export function exportExpensesToCSV(expenses: Expense[], tripName: string): void {
  const csv = [csvRow(EXPENSE_HEADERS.map((h) => csvCell(h))), ...expenses.map(expenseRow)].join('\r\n');
  downloadFile(csv, `${safeFilename(tripName)}_ledger.csv`, 'text/csv;charset=utf-8');
}

export function exportTripToCSV(trip: Trip, expenses: Expense[]): void {
  const spent = sumSpent(expenses);
  const left = trip.budget - spent;
  const summary: string[][] = [
    ['Trip', trip.name],
    ['Destination', countryName(trip.destinationCountry)],
    ['Start date', isoDay(trip.startDate)],
    ['End date', isoDay(trip.endDate)],
    ['Currency', trip.currency],
  ];
  const lines = [
    ...summary.map(([k, v]) => csvRow([csvCell(k), csvCell(v)])),
    csvRow([csvCell('Budget'), csvCell(plainAmount(trip.budget, trip.currency), { numeric: true })]),
    csvRow([csvCell('Spent'), csvCell(plainAmount(spent, trip.currency), { numeric: true })]),
    csvRow([csvCell('Left'), csvCell(plainAmount(left, trip.currency), { numeric: true })]),
    '',
    csvRow(EXPENSE_HEADERS.map((h) => csvCell(h))),
    ...expenses.map(expenseRow),
  ];
  downloadFile(lines.join('\r\n'), `${safeFilename(trip.name)}_report.csv`, 'text/csv;charset=utf-8');
}

export function exportAllTripsToCSV(trips: Trip[]): void {
  const headers = ['Name', 'Destination', 'Start date', 'End date', 'Budget', 'Spent', 'Currency'];
  const rows = trips.map((t) =>
    csvRow([
      csvCell(t.name),
      csvCell(countryName(t.destinationCountry)),
      csvCell(isoDay(t.startDate)),
      csvCell(isoDay(t.endDate)),
      csvCell(plainAmount(t.budget, t.currency), { numeric: true }),
      csvCell(plainAmount(t.totalExpenses ?? 0, t.currency), { numeric: true }),
      csvCell(t.currency),
    ])
  );
  downloadFile([csvRow(headers.map((h) => csvCell(h))), ...rows].join('\r\n'), 'travelluhh_trips.csv', 'text/csv;charset=utf-8');
}

// ── Print report ────────────────────────────────────────────────────────────

/** Self-contained HTML. Every interpolated value is escaped and a CSP blocks any script. */
export function generateTripPDFContent(trip: Trip, expenses: Expense[]): string {
  const c = trip.currency;
  const spent = sumSpent(expenses);
  const left = trip.budget - spent;
  const byCategory = new Map<string, number>();
  for (const e of expenses) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + (Number(e.amount) || 0));

  const money = (n: number) => escapeHtml(formatMoney(n, c));
  const leftText = left < 0 ? `${formatMoney(-left, c)} over` : formatMoney(left, c);

  const categoryRows = Array.from(byCategory.entries())
    .map(([cat, amount]) => `<tr><td>${escapeHtml(categoryLabel(cat))}</td><td class="num">${money(amount)}</td></tr>`)
    .join('');

  const expenseRows = expenses
    .map((e) => {
      const d = parseLocalDate(e.expenseDate);
      const foreign = e.originalCurrency && e.originalCurrency !== c && e.originalAmount != null;
      const paid = foreign ? `<div class="sub">${escapeHtml(formatMoney(e.originalAmount as number, e.originalCurrency))}</div>` : '';
      return `<tr>
        <td class="mono">${escapeHtml(isValidDate(d) ? format(d, 'd MMM yyyy') : e.expenseDate)}</td>
        <td>${escapeHtml(categoryLabel(e.category))}</td>
        <td>${escapeHtml(e.description)}${e.notes ? `<div class="sub">${escapeHtml(e.notes)}</div>` : ''}</td>
        <td class="num">${foreign ? '&asymp;&nbsp;' : ''}${money(Number(e.amount) || 0)}${paid}</td>
      </tr>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>${escapeHtml(trip.name)} · TravelLuhh report</title>
<style>
  body { font-family: 'Schibsted Grotesk', system-ui, sans-serif; color: ${light.ink}; background: #fff; margin: 0 auto; padding: 40px; max-width: 800px; }
  h1 { font-family: 'Newsreader', Georgia, serif; font-weight: 600; font-size: 32px; margin: 0 0 4px; }
  h2 { font-size: 13px; letter-spacing: .08em; text-transform: uppercase; color: ${light.ink2}; margin: 32px 0 8px; }
  .mono, .num, .meta, .figures { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
  .meta { color: ${light.ink2}; font-size: 13px; text-transform: uppercase; letter-spacing: .04em; }
  .figures { display: flex; gap: 40px; margin: 24px 0; padding: 16px 0; border-top: 1px solid ${light.rule}; border-bottom: 1px solid ${light.rule}; }
  .figures div span { display: block; font-size: 11px; color: ${light.ink2}; text-transform: uppercase; letter-spacing: .08em; }
  .figures div strong { font-size: 20px; font-weight: 500; }
  .over { color: ${light.stamp}; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { padding: 8px 6px; text-align: left; border-bottom: 1px solid ${light.rule}; vertical-align: top; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: ${light.ink2}; font-weight: 500; }
  .num { text-align: right; white-space: nowrap; }
  .sub { color: ${light.ink3}; font-size: 12px; }
</style>
</head>
<body>
  <h1>${escapeHtml(trip.name)}</h1>
  <div class="meta">${escapeHtml(countryName(trip.destinationCountry))} · ${escapeHtml(formatRange(trip.startDate, trip.endDate))}</div>
  <div class="figures">
    <div><span>Budget</span><strong>${money(trip.budget)}</strong></div>
    <div><span>Spent</span><strong>${money(spent)}</strong></div>
    <div><span>Left</span><strong class="${left < 0 ? 'over' : ''}">${escapeHtml(leftText)}</strong></div>
  </div>
  <h2>By category</h2>
  <table><tbody>${categoryRows || '<tr><td>No entries yet.</td></tr>'}</tbody></table>
  <h2>Ledger</h2>
  <table>
    <thead><tr><th>Date</th><th>Category</th><th>Description</th><th class="num">Amount</th></tr></thead>
    <tbody>${expenseRows || '<tr><td colspan="4">No entries yet.</td></tr>'}</tbody>
  </table>
</body>
</html>`;
}

/**
 * Opens the report in a new tab and prints it. Returns false when the popup was blocked; the report is
 * then downloaded as an .html file instead (show a toast saying so).
 */
export function printTripReport(trip: Trip, expenses: Expense[]): boolean {
  const content = generateTripPDFContent(trip, expenses);
  const url = URL.createObjectURL(new Blob([content], { type: 'text/html;charset=utf-8' }));
  const win = window.open(url, '_blank');
  if (!win) {
    URL.revokeObjectURL(url);
    downloadFile(content, `${safeFilename(trip.name)}_report.html`, 'text/html;charset=utf-8');
    return false;
  }
  win.addEventListener('load', () => {
    win.print();
    URL.revokeObjectURL(url);
  });
  return true;
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  // BOM so Excel reads UTF-8 (¥, ₩, accented names) correctly.
  const body = mimeType.startsWith('text/csv') ? `\uFEFF${content}` : content;
  const url = URL.createObjectURL(new Blob([body], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
