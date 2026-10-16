// <IsoStage> (§7.8): one scene slot. The SVG twin paints first with DOM labels and targets; when the gate
// passes and the slot nears the viewport, the registry (three + r3f + the scene) loads lazily, the canvas
// mounts invisibly and crossfades in after its first frame. Nothing in this file imports three.js.
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ThemeName } from '@/design/tokens';
import { dprFor, noteContextLost } from '@/iso/gate';
import { loadedIsoRegistry, prefetchIsoScenes, type IsoRegistryModule } from '@/iso/prefetch';
import {
  use3DGate,
  useCoarsePointer,
  useElementSize,
  useInView,
  usePageVisible,
  usePrinting,
  useIsoTheme,
  useReducedMotion,
} from '@/iso/hooks';
import { computeView, maxPan, toScreen } from '@/iso/projection';
import { labelCap } from '@/iso/overlay';
import { SceneLabels, SceneTargets } from '@/iso/SceneLabels';
import type { PanStart, SceneKind, SceneSpecBase, SceneTarget, Vec3 } from '@/iso/specs';
import { IsoSvgFrame } from '@/iso/svg/IsoSvg';
import { svgTwins } from '@/iso/svg/registry';
import type { IsoTier, StageFit, StageMode } from '@/iso/types';

const FADE_MS = 150;
const PAN_ANCHOR: Record<PanStart, number> = { start: -Infinity, center: 0, end: Infinity };
const DEFAULT_FIT: Partial<Record<SceneKind, StageFit>> = { kampung: 'height' };

export interface IsoStageProps {
  /** Any scene spec; spec.kind picks the SVG twin and the lazy 3D scene. */
  spec: SceneSpecBase;
  /** Reserved slot height in px: base (mobile) and lg (≥1024). No layout shift either way. */
  height: { base: number; lg?: number };
  /** TripPlot only. */
  mode?: StageMode;
  /** Create flow step 1..5 (TripPlot draft mode). */
  draftStep?: number;
  /** Called when a DOM target is activated (in addition to navigating when it has an href). */
  onTarget?: (target: SceneTarget) => void;
  className?: string;
  /**
   * Visible line under the slot. Default: spec.summary plus the unit chip. Pass E4's <SceneSummary spec />
   * here to use the motif, or null when the page already shows the summary next to the stage.
   */
  footer?: ReactNode;
  /** Defaults per kind (Kampung pans: 'height'). */
  fit?: StageFit;
  /**
   * Where a panning scene starts: overrides `spec.panStart` (default 'center'). Re-applied when the scene's
   * kind, bounds or anchor change (e.g. a new year tab); a drag or ◀ ▶ press is kept until then.
   */
  panStart?: PanStart;
  /**
   * Labels always shown before the rest go hover/focus-only. Overrides `spec.maxLabels`; default 4 (§7.8).
   * Mappers that size their labels to never collide set `spec.maxLabels` themselves (desktop Shelf: 5).
   */
  maxLabels?: number;
  /**
   * DOM layer above the scene, positioned with the same projection as labels, e.g. a PassportStamp at
   * spec.stamp.at. `project` maps a world point to slot pixels (CSS px from the slot's top-left). Called on
   * resize, pan and data change, never per frame. Not clickable (pointer-events: none); sits outside the
   * role="img" slot so its own accessible text is still read.
   */
  overlay?: (project: (p: Vec3) => [number, number]) => ReactNode;
  /** Dev kit / tests: force a theme instead of the resolved one. */
  theme?: ThemeName;
  /** Dev kit: force SVG only. */
  svgOnly?: boolean;
  /** Dev kit: force a tier. */
  tier?: IsoTier;
}

export function IsoStage({
  spec,
  height,
  mode,
  draftStep,
  onTarget,
  className,
  footer,
  fit: fitProp,
  panStart: panStartProp,
  maxLabels,
  overlay,
  theme: themeProp,
  svgOnly,
  tier: tierProp,
}: IsoStageProps) {
  const slotRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(slotRef);
  const theme = useIsoTheme(themeProp);
  const reducedMotion = useReducedMotion();
  const printing = usePrinting();
  const coarse = useCoarsePointer();
  const pageVisible = usePageVisible();
  const [gateBump, setGateBump] = useState(0);
  const gate = use3DGate(gateBump);
  const allow3D = gate.ok && !svgOnly;
  const near = useInView(slotRef, '200px', true);
  const onScreen = useInView(slotRef, '0px');
  const fit = fitProp ?? DEFAULT_FIT[spec.kind] ?? 'contain';

  const [mod, setMod] = useState<IsoRegistryModule | null>(loadedIsoRegistry);
  const [lost, setLost] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const [readyKind, setReadyKind] = useState<SceneKind | null>(null);
  const [declined, setDeclined] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Pan state is tied to an anchor key: new bounds / kind / anchor start again from the anchor. ±Infinity is
  // a valid anchor because computeView clamps pan to the scene's own limit.
  const panStart = panStartProp ?? spec.panStart ?? 'center';
  const anchorKey = `${spec.kind}|${panStart}|${spec.bounds.min.join(',')}|${spec.bounds.max.join(',')}`;
  const anchorPan = PAN_ANCHOR[panStart];
  const [panState, setPanState] = useState({ key: anchorKey, value: anchorPan });
  const rawPan = panState.key === anchorKey ? panState.value : anchorPan;

  useEffect(() => {
    if (!allow3D || !near || mod) return;
    let alive = true;
    prefetchIsoScenes()
      .then((m) => alive && setMod(m))
      .catch(() => {
        // chunk failed to load: the SVG twin simply stays
      });
    return () => {
      alive = false;
    };
  }, [allow3D, near, mod]);

  const canvasOn = allow3D && !!mod && !lost;
  const threeReady = canvasOn && readyKind === spec.kind;

  const [svgGone, setSvgGone] = useState(false);
  useEffect(() => {
    if (!threeReady) {
      setSvgGone(false);
      return;
    }
    const t = window.setTimeout(() => setSvgGone(true), FADE_MS + 30);
    return () => window.clearTimeout(t);
  }, [threeReady]);

  // A kind change keeps the canvas but needs a fresh first frame before the twin fades again.
  useEffect(() => {
    setReadyKind((k) => (k === spec.kind ? k : null));
  }, [spec.kind]);

  const onFirstFrame = useCallback((kind: SceneKind) => setReadyKind(kind), []);

  const onContextLost = useCallback(() => {
    setReadyKind(null);
    setLost(true);
    if (noteContextLost()) {
      window.setTimeout(() => {
        setLost(false);
        setCanvasKey((k) => k + 1);
      }, 800);
    } else {
      setGateBump((b) => b + 1);
    }
  }, []);

  const onDecline = useCallback(() => setDeclined(true), []);

  const tier: IsoTier = tierProp ?? (declined ? 'lite' : gate.ok ? gate.tier : 'high');

  const view = useMemo(
    () => (size && size.w > 0 && size.h > 0 ? computeView(spec.bounds, size.w, size.h, { fit, pan: rawPan }) : null),
    [spec.bounds, size, fit, rawPan],
  );
  const panLimit = view && size && fit === 'height' ? maxPan(spec.bounds, size.w, view.zoom) : 0;
  const pan = Math.max(-panLimit, Math.min(panLimit, rawPan));
  const setPan = (next: number) => setPanState({ key: anchorKey, value: Math.max(-panLimit, Math.min(panLimit, next)) });
  const project = useMemo(
    () => (view && size ? (p: Vec3) => toScreen(p, view.zoom, view.center, size.w, size.h) : null),
    [view, size],
  );

  // Drag to pan (Kampung). Vertical page scroll stays native via touch-action: pan-y.
  const drag = useRef<{ x: number; pan: number } | null>(null);
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (panLimit <= 0) return;
    drag.current = { x: e.clientX, pan };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current || !view) return;
    setPan(drag.current.pan - (e.clientX - drag.current.x) / view.zoom);
  };
  const endDrag = () => {
    drag.current = null;
  };
  const step = view && size ? (size.w / view.zoom) * 0.6 : 0;
  const panBy = (dir: -1 | 1) => setPan(pan + dir * step);

  const Svg = svgTwins[spec.kind];
  const showSvg = !svgGone || printing || !canvasOn;
  const fade = reducedMotion ? 'none' : `opacity ${FADE_MS}ms ease-out`;
  const vars = { '--iso-h': `${height.base}px`, '--iso-h-lg': `${height.lg ?? height.base}px` } as CSSProperties;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        ref={slotRef}
        style={{ ...vars, touchAction: panLimit > 0 ? 'pan-y' : undefined }}
        className="relative h-[var(--iso-h)] w-full overflow-hidden lg:h-[var(--iso-h-lg)]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
      >
        <div role="img" aria-label={spec.summary} className="absolute inset-0">
          {canvasOn && mod ? (
            <div
              aria-hidden="true"
              className="absolute inset-0 print:hidden"
              style={{ opacity: threeReady ? 1 : 0, transition: threeReady ? fade : 'none' }}
            >
              <mod.IsoCanvas
                key={canvasKey}
                bounds={spec.bounds}
                fit={fit}
                pan={pan}
                theme={theme}
                tier={tier}
                dpr={dprFor(tier, coarse)}
                paused={!onScreen || !pageVisible}
                reducedMotion={reducedMotion}
                onContextLost={onContextLost}
                onDecline={tierProp ? undefined : onDecline}
              >
                <mod.SceneSwitch
                  kind={spec.kind}
                  Scene={mod.sceneRegistry[spec.kind].Scene}
                  sceneProps={{ spec, theme, tier, mode, draftStep, reducedMotion }}
                  onFirstFrame={onFirstFrame}
                />
              </mod.IsoCanvas>
            </div>
          ) : null}
          {showSvg ? (
            <div
              aria-hidden="true"
              className="absolute inset-0 print:!opacity-100"
              style={{ opacity: threeReady && !printing ? 0 : 1, transition: threeReady ? fade : 'none' }}
            >
              <IsoSvgFrame bounds={spec.bounds} theme={theme} view={view ?? undefined} size={size ?? undefined}>
                <Svg spec={spec} theme={theme} mode={mode} draftStep={draftStep} />
              </IsoSvgFrame>
            </div>
          ) : null}
          {view && size ? (
            <SceneLabels
              labels={spec.labels}
              view={view}
              size={size}
              activeId={activeId}
              maxVisible={labelCap(maxLabels, spec.maxLabels)}
            />
          ) : null}
        </div>
        {overlay && project ? (
          <div className="pointer-events-none absolute inset-0" data-iso-overlay="">
            {overlay(project)}
          </div>
        ) : null}
        {view && size ? (
          <SceneTargets targets={spec.targets} view={view} size={size} onTarget={onTarget} onActive={setActiveId} />
        ) : null}
        {panLimit > 0 ? (
          <>
            <PanButton side="left" disabled={pan <= -panLimit + 1e-3} onClick={() => panBy(-1)} />
            <PanButton side="right" disabled={pan >= panLimit - 1e-3} onClick={() => panBy(1)} />
          </>
        ) : null}
      </div>
      {footer === undefined ? <SummaryLine summary={spec.summary} unitChip={spec.unitChip} /> : footer}
    </div>
  );
}

function PanButton({ side, disabled, onClick }: { side: 'left' | 'right'; disabled: boolean; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={side === 'left' ? 'Show earlier trips' : 'Show later trips'}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-sm border border-rule bg-leaf text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40',
        side === 'left' ? 'left-2' : 'right-2',
      )}
    >
      <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}

/** Minimal visible summary (E4's SceneSummary motif can replace it via `footer`). */
function SummaryLine({ summary, unitChip }: { summary: string; unitChip?: string }) {
  return (
    <p className="type-body-s text-ink-2">
      {summary}
      {unitChip ? (
        <span className="type-overline ml-2 inline-block whitespace-nowrap rounded-sm border border-brass-ink px-1.5 py-px align-middle font-mono normal-case text-ink-2">
          {unitChip}
        </span>
      ) : null}
    </p>
  );
}

export default IsoStage;
