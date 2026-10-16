// The one WebGL canvas (§7.1, §7.8): orthographic, flat (no tone mapping), transparent, demand frameloop.
// Owns the camera rig, the tween driver and the GPU resource cache lifetime. Lazy chunk only.
import { useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import type { OrthographicCamera } from 'three';
import type { ThemeName } from '@/design/tokens';
import { IsoContext, type IsoContextValue } from '@/iso/canvas/context';
import { releaseIsoResources, retainIsoResources } from '@/iso/material/cache';
import { palette3d } from '@/iso/palette3d';
import { CAMERA_OFFSET, computeView, type Bounds } from '@/iso/projection';
import { createTweenStore, type TweenStore } from '@/iso/tween';
import type { IsoTier, IsoView, StageFit } from '@/iso/types';

export interface IsoCanvasProps {
  bounds: Bounds;
  fit?: StageFit;
  /** Screen units along SCREEN_RIGHT (Kampung). */
  pan?: number;
  /** Custom framing (e.g. fitPoints) instead of computeView(bounds). Must be what the overlays use too. */
  view?: (w: number, h: number) => IsoView;
  theme: ThemeName;
  tier: IsoTier;
  dpr: number | [number, number];
  /** Offscreen or tab hidden → frameloop 'never'. */
  paused?: boolean;
  reducedMotion: boolean;
  onContextLost?: () => void;
  /** drei PerformanceMonitor decided this device can't keep up → caller drops to lite. */
  onDecline?: () => void;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

interface RigProps {
  bounds: Bounds;
  fit?: StageFit;
  pan?: number;
  view?: (w: number, h: number) => IsoView;
}

function CameraRig({ bounds, fit, pan, view }: RigProps) {
  const camera = useThree((s) => s.camera) as OrthographicCamera;
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const invalidate = useThree((s) => s.invalidate);
  const { zoom, center } = view ? view(width, height) : computeView(bounds, width, height, { fit, pan });
  const [cx, cy, cz] = center;
  useLayoutEffect(() => {
    camera.position.set(cx + CAMERA_OFFSET[0], cy + CAMERA_OFFSET[1], cz + CAMERA_OFFSET[2]);
    camera.up.set(0, 1, 0);
    camera.lookAt(cx, cy, cz);
    camera.zoom = zoom;
    camera.near = 0.1;
    camera.far = 400;
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, cx, cy, cz, zoom, invalidate]);
  return null;
}

function TweenDriver({ store, reducedMotion }: { store: TweenStore; reducedMotion: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  const wasActive = useRef(false);
  useEffect(() => {
    store.setInvalidate(invalidate);
    return () => store.setInvalidate(null);
  }, [store, invalidate]);
  useEffect(() => {
    store.setReducedMotion(reducedMotion);
  }, [store, reducedMotion]);
  useFrame((_, delta) => {
    if (!store.active) {
      wasActive.current = false;
      return;
    }
    // After an idle stretch the clock delta is huge; start every burst on a normal frame.
    const dt = wasActive.current ? Math.min(delta, 0.1) : 1 / 60;
    wasActive.current = true;
    if (store.step(dt)) invalidate();
  });
  return null;
}

/** Re-render once when something outside the scene graph changes (theme, un-pause). */
function Wake({ token }: { token: string }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
  }, [token, invalidate]);
  return null;
}

const GL = {
  antialias: true,
  alpha: true,
  powerPreference: 'low-power',
  failIfMajorPerformanceCaveat: true,
} as const;

const CAMERA = { position: CAMERA_OFFSET, zoom: 60, near: 0.1, far: 400 };

export function IsoCanvas({
  bounds,
  fit,
  pan,
  view,
  theme,
  tier,
  dpr,
  paused,
  reducedMotion,
  onContextLost,
  onDecline,
  className,
  style,
  children,
}: IsoCanvasProps) {
  const tweens = useMemo(() => createTweenStore(), []);
  const lostRef = useRef(onContextLost);
  lostRef.current = onContextLost;

  useEffect(() => {
    retainIsoResources();
    return () => releaseIsoResources();
  }, []);

  const ctx = useMemo<IsoContextValue>(
    () => ({ theme, tier, palette: palette3d(theme), tweens, reducedMotion }),
    [theme, tier, tweens, reducedMotion],
  );

  return (
    <Canvas
      orthographic
      flat
      frameloop={paused ? 'never' : 'demand'}
      camera={CAMERA}
      gl={GL}
      dpr={dpr}
      className={className}
      style={{ pointerEvents: 'none', ...style }}
      onCreated={({ gl }) => {
        gl.domElement.setAttribute('aria-hidden', 'true');
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          lostRef.current?.();
        });
      }}
    >
      <IsoContext.Provider value={ctx}>
        <CameraRig bounds={bounds} fit={fit} pan={pan} view={view} />
        <TweenDriver store={tweens} reducedMotion={reducedMotion} />
        <Wake token={`${theme}|${tier}|${paused ? 1 : 0}`} />
        {tier === 'high' && onDecline ? <PerformanceMonitor onDecline={onDecline} /> : null}
        {children}
      </IsoContext.Provider>
    </Canvas>
  );
}

export default IsoCanvas;
