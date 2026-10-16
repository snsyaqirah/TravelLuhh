import { fireEvent, render, screen, within } from '@testing-library/react';
import { IsoStage } from '@/iso/IsoStage';
import { StageAnchor } from '@/iso/StageAnchor';
import { resetGateForTests } from '@/iso/gate';
import { mapKampung } from '@/iso/mappers/kampung';
import { mapTripPlot } from '@/iso/mappers/tripPlot';

// Real TripPlot geometry (so the twin can draw it) with stage-level fields replaced to pin the label cap,
// target rendering and summary behaviour.
const base = mapTripPlot({
  trip: { id: 1, name: 'Tokyo autumn', destinationCountry: 'JP', startDate: '2026-11-12', endDate: '2026-11-20', budget: 4000, currency: 'MYR' },
  expenses: [{ expenseDate: '2026-11-12', amount: 1474 }, { expenseDate: '2026-11-14', amount: 186 }],
  today: new Date(2026, 10, 14, 15),
});

const spec = {
  ...base,
  labels: [
    { id: 'a', at: [1, 2, 1], text: 'RM 2,340 left', tone: 'fund' },
    { id: 'b', at: [3, 0, 0.5], text: 'Day 1' },
    { id: 'c', at: [4, 0, 0.5], text: 'Day 2' },
    { id: 'd', at: [5, 0, 0.5], text: 'Day 3' },
    { id: 'e', at: [6, 0, 0.5], text: 'Day 4' },
  ],
  targets: [
    { id: 'e', at: [6, 0, 0.5], ariaLabel: 'Day 4, 15 Nov: RM 120 spent', href: '/trips/1/ledger?day=2026-11-15' },
    { id: 'x', at: [1, 0, 1], ariaLabel: 'Open the fund' },
  ],
  summary: 'Tokyo autumn: RM 2,340 of RM 4,000 left. Day 3 of 9.',
  unitChip: '1 coin = RM 20',
} satisfies typeof base;

describe('IsoStage (no WebGL in jsdom → SVG twin)', () => {
  let rect: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    resetGateForTests();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
    rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 375,
      height: 220,
      top: 0,
      left: 0,
      right: 375,
      bottom: 220,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    rect.mockRestore();
  });

  it('paints the twin with an accessible summary and reserved height', () => {
    const { container } = render(<IsoStage spec={spec} height={{ base: 220, lg: 320 }} />);
    const slot = screen.getByRole('img', { name: spec.summary });
    expect(slot.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('canvas')).toBeNull();
    expect(screen.getByText(/Day 3 of 9\./)).toBeVisible();
    expect(screen.getByText('1 coin = RM 20')).toBeInTheDocument();
    const reserved = slot.parentElement as HTMLElement;
    expect(reserved.style.getPropertyValue('--iso-h')).toBe('220px');
    expect(reserved.style.getPropertyValue('--iso-h-lg')).toBe('320px');
  });

  it('shows at most four labels and renders targets as DOM controls', () => {
    render(<IsoStage spec={spec} height={{ base: 220 }} />);
    const slot = screen.getByRole('img', { name: spec.summary });
    expect(within(slot).getByText('RM 2,340 left')).toBeInTheDocument();
    expect(within(slot).queryByText('Day 4')).toBeNull();
    // href target outside a router falls back to a plain link; action targets are buttons
    expect(screen.getByRole('link', { name: /Day 4, 15 Nov/ })).toHaveAttribute('href', '/trips/1/ledger?day=2026-11-15');
    expect(screen.getByRole('button', { name: 'Open the fund' })).toBeInTheDocument();
  });

  it('lets a page raise the label cap and place a DOM overlay with the stage projection', () => {
    render(
      <IsoStage
        spec={spec}
        height={{ base: 220 }}
        maxLabels={5}
        overlay={(project) => {
          const [x, y] = project([1, 2, 1]);
          return (
            <>
              <span data-testid="stamp" data-x={Math.round(x)} data-y={Math.round(y)} />
              <StageAnchor point={project([1, 2, 1])} side="above">
                <span>BALIK</span>
              </StageAnchor>
            </>
          );
        }}
      />,
    );
    const anchored = screen.getByText('BALIK').parentElement as HTMLElement;
    expect(anchored.style.transform).toMatch(/^translate\(\d+px, -?\d+px\) translate\(-50%, calc\(-100% - 6px\)\)$/);
    const slot = screen.getByRole('img', { name: spec.summary });
    expect(within(slot).getByText('Day 4')).toBeInTheDocument();
    const stamp = screen.getByTestId('stamp');
    // outside the img role, so a stamp's own label stays readable
    expect(slot.contains(stamp)).toBe(false);
    expect(Number(stamp.dataset.x)).toBeGreaterThan(0);
    expect(Number(stamp.dataset.x)).toBeLessThan(375);
  });

  it('takes the label cap from the spec, and the prop wins over it', () => {
    const { unmount } = render(<IsoStage spec={{ ...spec, maxLabels: 5 }} height={{ base: 220 }} />);
    let slot = screen.getByRole('img', { name: spec.summary });
    expect(within(slot).getByText('Day 4')).toBeInTheDocument();
    unmount();
    render(<IsoStage spec={{ ...spec, maxLabels: 5 }} height={{ base: 220 }} maxLabels={1} />);
    slot = screen.getByRole('img', { name: spec.summary });
    expect(within(slot).getByText('RM 2,340 left')).toBeInTheDocument();
    expect(within(slot).queryByText('Day 1')).toBeNull();
  });

  it('reveals a focusOnly label only while its target is focused', () => {
    const withReveal = {
      ...spec,
      labels: [{ id: 'x', at: [1, 0, 1] as [number, number, number], text: 'Fund detail', focusOnly: true }, ...spec.labels.slice(0, 2)],
    };
    render(<IsoStage spec={withReveal} height={{ base: 220 }} />);
    const slot = screen.getByRole('img', { name: spec.summary });
    expect(within(slot).getByText('Day 1')).toBeInTheDocument();
    expect(within(slot).queryByText('Fund detail')).toBeNull();
    const target = screen.getByRole('button', { name: 'Open the fund' });
    fireEvent.focus(target);
    expect(within(slot).getByText('Fund detail')).toBeInTheDocument();
    fireEvent.blur(target);
    expect(within(slot).queryByText('Fund detail')).toBeNull();
  });

  it('starts a panning scene at spec.panStart, and the page can override it', () => {
    const k = (id: number, start: string, end: string) => ({
      id,
      name: `Trip ${id}`,
      destinationCountry: 'JP',
      startDate: start,
      endDate: end,
      budget: 4000,
      currency: 'MYR',
      totalExpenses: 3000,
    });
    const kampung = mapKampung({
      trips: [
        k(1, '2024-02-09', '2024-02-11'),
        k(2, '2025-04-02', '2025-04-10'),
        k(3, '2026-01-12', '2026-01-20'),
        k(4, '2026-03-05', '2026-03-08'),
        k(5, '2026-05-01', '2026-05-14'),
      ],
      year: 'all',
      homeCurrency: 'MYR',
      rates: null,
      today: new Date(2026, 9, 15),
    });
    // All years: spec.panStart is 'start', so the first trip is in view
    const { unmount } = render(<IsoStage spec={kampung} height={{ base: 220 }} />);
    expect(screen.getByRole('button', { name: 'Show earlier trips' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Show later trips' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Show later trips' }));
    expect(screen.getByRole('button', { name: 'Show earlier trips' })).toBeEnabled();
    unmount();
    render(<IsoStage spec={kampung} height={{ base: 220 }} panStart="end" />);
    expect(screen.getByRole('button', { name: 'Show later trips' })).toBeDisabled();
  });

  it('accepts a custom footer in place of the summary line', () => {
    render(<IsoStage spec={spec} height={{ base: 220 }} footer={<p>custom</p>} />);
    expect(screen.getByText('custom')).toBeInTheDocument();
    expect(screen.queryByText('1 coin = RM 20')).toBeNull();
  });
});
