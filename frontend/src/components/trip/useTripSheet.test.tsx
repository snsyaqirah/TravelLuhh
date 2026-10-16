import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { IN_APP_SHEET_STATE, useTripSheet, type TripSheetState } from '@/components/trip/useTripSheet';

let sheet: TripSheetState;
let nav: ReturnType<typeof useNavigate>;
let loc: ReturnType<typeof useLocation>;

function TripPage() {
  sheet = useTripSheet();
  nav = useNavigate();
  loc = useLocation();
  return null;
}
function Elsewhere() {
  nav = useNavigate();
  loc = useLocation();
  return null;
}

const at = () => loc.pathname + loc.search;

function renderAt(entries: (string | { pathname: string; search?: string; state?: unknown })[]) {
  render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/trips" element={<Elsewhere />} />
        <Route path="/trips/:tripId/:tab" element={<TripPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('useTripSheet history', () => {
  it('open → close (X) → Back leaves the trip page, however many sheets were opened', async () => {
    renderAt(['/trips', '/trips/1/fund']);
    for (let i = 0; i < 3; i++) {
      await act(async () => sheet.open('log-spend'));
      expect(at()).toBe('/trips/1/fund?sheet=log-spend');
      await act(async () => sheet.close());
      expect(at()).toBe('/trips/1/fund');
    }
    await act(async () => nav(-1));
    expect(at()).toBe('/trips');
  });

  it('Back closes an open sheet, then the next Back leaves the trip', async () => {
    renderAt(['/trips', '/trips/1/ledger']);
    await act(async () => sheet.open('expense', { id: 42 }));
    await act(async () => nav(-1));
    expect(at()).toBe('/trips/1/ledger');
    await act(async () => nav(-1));
    expect(at()).toBe('/trips');
  });

  it('receipt → Edit (hand-off) → Save → Back leaves the trip instead of reopening the receipt', async () => {
    renderAt(['/trips', '/trips/1/ledger']);
    await act(async () => sheet.open('expense', { id: 42 })); // row tap
    await act(async () => sheet.open('log-spend', { id: 42, replace: true })); // TripDetail's onEdit
    expect(at()).toBe('/trips/1/ledger?sheet=log-spend&id=42');
    await act(async () => sheet.close()); // LogSpendSheet save → onOpenChange(false)
    expect(at()).toBe('/trips/1/ledger');
    await act(async () => nav(-1));
    expect(at()).toBe('/trips');
  });

  it('opening a sheet over an open one is a hand-off even without replace: close never reveals the old sheet', async () => {
    renderAt(['/trips', '/trips/1/ledger']);
    await act(async () => sheet.open('expense', { id: 42 }));
    await act(async () => sheet.open('log-spend', { id: 42 }));
    await act(async () => sheet.close());
    expect(at()).toBe('/trips/1/ledger');
    await act(async () => nav(-1));
    expect(at()).toBe('/trips');
  });

  it('a second close() for the same sheet (Save then onOpenChange) steps back only once', async () => {
    renderAt(['/trips', '/trips/1/fund']);
    await act(async () => sheet.open('drop-in'));
    const close = sheet.close;
    await act(async () => {
      close();
      close();
    });
    expect(at()).toBe('/trips/1/fund');
  });

  it('a deep-linked sheet (no in-app marker) closes in place, keeping the page entry', async () => {
    renderAt(['/trips', '/trips/1/fund?sheet=edit']);
    expect(sheet.sheet).toBe('edit');
    await act(async () => sheet.close());
    expect(at()).toBe('/trips/1/fund');
    await act(async () => nav(-1));
    expect(at()).toBe('/trips');
  });

  it('a hand-off from a deep-linked sheet stays a deep link (closes in place)', async () => {
    renderAt(['/trips', '/trips/1/ledger?sheet=expense&id=42']);
    await act(async () => sheet.open('log-spend', { id: 42, replace: true }));
    expect(loc.state).toBeNull();
    await act(async () => sheet.close());
    expect(at()).toBe('/trips/1/ledger');
    await act(async () => nav(-1));
    expect(at()).toBe('/trips');
  });

  it('a sheet entry pushed by the shell (FAB) with the marker closes by stepping back', async () => {
    renderAt(['/trips', '/trips/1/fund', { pathname: '/trips/1/fund', search: '?sheet=log-spend', state: IN_APP_SHEET_STATE }]);
    await act(async () => sheet.close());
    expect(at()).toBe('/trips/1/fund');
    await act(async () => nav(-1));
    expect(at()).toBe('/trips');
  });

  it('Forward back onto a closed sheet can be closed again', async () => {
    renderAt(['/trips', '/trips/1/fund']);
    await act(async () => sheet.open('logbook'));
    await act(async () => sheet.close());
    await act(async () => nav(1));
    expect(at()).toBe('/trips/1/fund?sheet=logbook');
    await act(async () => sheet.close());
    expect(at()).toBe('/trips/1/fund');
  });
});
