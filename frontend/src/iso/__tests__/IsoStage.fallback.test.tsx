// IsoStage keeps 3D failures inside the stage: when the canvas or a scene throws (no WebGL2 context, a
// driver error, a scene chunk that didn't load) the slot shows its SVG twin and the page keeps rendering.
import { Component, type ReactNode } from 'react';
import { act, render, screen } from '@testing-library/react';

const fake = vi.hoisted(() => ({ error: null as unknown }));

vi.mock('@/iso/prefetch', () => {
  const Throwing = () => {
    throw fake.error;
  };
  const mod = {
    IsoCanvas: Throwing,
    SceneSwitch: () => null,
    sceneRegistry: new Proxy({}, { get: () => ({ Scene: () => null }) }),
  };
  return { loadedIsoRegistry: () => null, prefetchIsoScenes: () => Promise.resolve(mod) };
});

import { IsoStage } from '@/iso/IsoStage';
import { get3DGate, resetGateForTests } from '@/iso/gate';
import { mapTripPlot } from '@/iso/mappers/tripPlot';

const spec = mapTripPlot({
  trip: { id: 1, name: 'Tokyo autumn', destinationCountry: 'JP', startDate: '2026-11-12', endDate: '2026-11-20', budget: 4000, currency: 'MYR' },
  expenses: [{ expenseDate: '2026-11-12', amount: 1474 }],
  today: new Date(2026, 10, 14, 15),
});

class RouteBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <h1>This page hit a snag.</h1> : this.props.children;
  }
}

async function mountStage() {
  const ui = render(
    <RouteBoundary>
      <p>Rest of the trip page</p>
      <IsoStage spec={spec} height={{ base: 220 }} />
    </RouteBoundary>,
  );
  // let the (mocked) lazy registry resolve and the canvas try to mount
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return ui;
}

describe('IsoStage 3D failure → SVG twin, never the route error page', () => {
  beforeEach(() => {
    resetGateForTests();
    // the gate's probe sees a WebGL2 context, so the stage goes on to load the 3D registry
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => ({ getExtension: () => ({ loseContext() {} }) }) as unknown as RenderingContext,
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('a renderer that throws (e.g. no WebGL2 context) flips the stage to SVG and turns 3D off for the session', async () => {
    fake.error = new Error('Error creating WebGL context.');
    expect(get3DGate().ok).toBe(true);
    const { container } = await mountStage();
    expect(screen.queryByText('This page hit a snag.')).toBeNull();
    expect(screen.getByText('Rest of the trip page')).toBeInTheDocument();
    const slot = screen.getByRole('img', { name: spec.summary });
    expect(slot.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('canvas')).toBeNull();
    expect(get3DGate()).toEqual({ ok: false, reason: 'render-error' });
  });

  it('a scene chunk that failed to download keeps this stage flat but leaves 3D on for the session', async () => {
    fake.error = new TypeError('Failed to fetch dynamically imported module: /assets/TripPlot-abc.js');
    await mountStage();
    expect(screen.queryByText('This page hit a snag.')).toBeNull();
    expect(screen.getByRole('img', { name: spec.summary }).querySelector('svg')).not.toBeNull();
    expect(get3DGate().ok).toBe(true);
  });
});
