// The context-loss listener (§7.8): a real loss while the canvas is on the page reports once; the loss R3F
// forces on the detached canvas ~500 ms after unmount (to free the GPU) must not count against the session.
import { useEffect, useRef } from 'react';
import { render } from '@testing-library/react';

const created = vi.hoisted(() => ({ canvas: null as HTMLCanvasElement | null }));

vi.mock('@react-three/fiber', () => ({
  // Stand-in for R3F's Canvas: a real <canvas>, onCreated with its gl.domElement, children not rendered.
  Canvas: ({ onCreated }: { onCreated?: (s: { gl: { domElement: HTMLCanvasElement } }) => void }) => {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
      created.canvas = ref.current;
      if (ref.current) onCreated?.({ gl: { domElement: ref.current } });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <canvas ref={ref} />;
  },
  useFrame: () => {},
  useThree: () => undefined,
}));
vi.mock('@react-three/drei', () => ({ PerformanceMonitor: () => null }));

import { IsoCanvas } from '@/iso/canvas/IsoCanvas';

const bounds = { min: [0, 0, 0], max: [4, 2, 4] } as never;
const lose = (c: HTMLCanvasElement) => {
  const e = new Event('webglcontextlost', { cancelable: true });
  c.dispatchEvent(e);
  return e;
};

describe('IsoCanvas context loss', () => {
  it('reports a loss while mounted (and keeps the context restorable), ignores the forced loss after unmount', () => {
    const onContextLost = vi.fn();
    const { unmount } = render(
      <IsoCanvas bounds={bounds} theme="light" tier="high" dpr={1} reducedMotion onContextLost={onContextLost} />,
    );
    const canvas = created.canvas as HTMLCanvasElement;
    expect(canvas.getAttribute('aria-hidden')).toBe('true');

    const real = lose(canvas);
    expect(onContextLost).toHaveBeenCalledTimes(1);
    expect(real.defaultPrevented).toBe(true);

    unmount(); // route change
    expect(canvas.isConnected).toBe(false);
    lose(canvas); // R3F's gl.forceContextLoss() 500 ms later
    lose(canvas);
    expect(onContextLost).toHaveBeenCalledTimes(1);
  });

  it('three page visits never report a loss', () => {
    const onContextLost = vi.fn();
    for (let i = 0; i < 3; i++) {
      const { unmount } = render(
        <IsoCanvas bounds={bounds} theme="light" tier="high" dpr={1} reducedMotion onContextLost={onContextLost} />,
      );
      const canvas = created.canvas as HTMLCanvasElement;
      unmount();
      lose(canvas);
    }
    expect(onContextLost).not.toHaveBeenCalled();
  });
});
