// /dev/iso-kit (§14): every primitive in WebGL next to its SVG twin, in both themes, plus the three render
// states and a live IsoStage per scene kind. Dev only; this is where face tones, edges and dashes get locked.
import { lazy, Suspense, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { tokens, CATEGORY_ORDER, type ThemeName } from '@/design/tokens';
import { faceTones } from '@/iso/faceTones';
import { get3DGate } from '@/iso/gate';
import { useElementSize, useReducedMotion } from '@/iso/hooks';
import { IsoStage } from '@/iso/IsoStage';
import { stageFixtures } from '@/iso/kit/fixtures';
import { MotionBoardSvg, PrimitiveBoardSvg, StateBoardSvg } from '@/iso/kit/KitSvgBoards';
import type { FrameStats, MotionState } from '@/iso/kit/Kit3DBoards';
import {
  MOTION_BOUNDS,
  MOTION_POINTS,
  PRIMITIVE_BOUNDS,
  PRIMITIVE_CELLS,
  STATE_BOUNDS,
  STATE_LABELS,
  STATE_POINTS,
  cellLabel,
  cellPoints,
  type CellId,
} from '@/iso/kit/layout';
import { palette3d } from '@/iso/palette3d';
import { fitPoints, type Bounds } from '@/iso/projection';
import { SceneLabels } from '@/iso/SceneLabels';
import type { SceneLabel, Vec3 } from '@/iso/specs';
import { IsoSvgFrame } from '@/iso/svg/IsoSvg';
import type { IsoTier } from '@/iso/types';

const KitBoard3D = lazy(() => import('@/iso/kit/Kit3DBoards'));

type Board = 'primitives' | 'states' | 'motion';

function readParam(name: string): string | null {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="type-overline text-ink-3">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex rounded-sm border border-rule">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'type-label h-9 px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring',
              value === o.value ? 'bg-ink text-paper' : 'bg-leaf text-ink-2',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function KitFrame({
  theme,
  board,
  render,
  tier,
  bounds,
  points,
  labels,
  caption,
  cells,
  heightClass,
  motion,
}: {
  theme: ThemeName;
  board: Board;
  render: '3d' | 'svg';
  tier: IsoTier;
  bounds: Bounds;
  points: Vec3[];
  labels: SceneLabel[];
  caption: string;
  cells?: CellId[];
  heightClass: string;
  motion?: MotionState;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLSpanElement>(null);
  // Written imperatively: a React update per frame would itself cost frames.
  const onFrame = useMemo(
    () => (s: FrameStats) => {
      if (statsRef.current) statsRef.current.textContent = ` · frames ${s.frames} · calls ${s.calls} · tris ${s.triangles}`;
    },
    [],
  );
  const size = useElementSize(ref);
  const reducedMotion = useReducedMotion();
  // The kit lays cells out along screen axes, so frame the cells' corner points rather than world bounds.
  const fit = useMemo(() => (w: number, h: number) => fitPoints(points, w, h, 0.03), [points]);
  const view = useMemo(() => (size ? fit(size.w, size.h) : null), [fit, size]);
  return (
    <figure className={cn('flex min-w-0 flex-1 flex-col gap-1', theme === 'dark' && 'dark')}>
      <div
        ref={ref}
        className={cn('relative w-full overflow-hidden rounded-sm border border-rule', heightClass)}
        style={{ background: tokens[theme].paper }}
      >
        {render === '3d' ? (
          <Suspense fallback={null}>
            <KitBoard3D
              board={board}
              theme={theme}
              tier={tier}
              reducedMotion={reducedMotion}
              view={fit}
              cells={cells}
              onFrame={onFrame}
              motion={motion}
            />
          </Suspense>
        ) : (
          <IsoSvgFrame bounds={bounds} theme={theme} view={view ?? undefined} size={size ?? undefined}>
            {board === 'primitives' ? (
              <PrimitiveBoardSvg cells={cells} />
            ) : board === 'states' ? (
              <StateBoardSvg />
            ) : (
              <MotionBoardSvg jarFill={motion?.jarFill ?? 0} stack={motion?.stack ?? 0} />
            )}
          </IsoSvgFrame>
        )}
        {view && size ? <SceneLabels labels={labels} view={view} size={size} maxVisible={labels.length} /> : null}
      </div>
      <figcaption className="type-overline text-ink-3">
        {caption}
        {render === '3d' ? <span ref={statsRef} /> : null}
      </figcaption>
    </figure>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="type-title text-ink">{title}</h2>
        {note ? <p className="type-body-s text-ink-2">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ToneSwatches({ theme }: { theme: ThemeName }) {
  const p = palette3d(theme);
  const rows: Array<[string, string]> = [
    ['ground', p.ground],
    ['soil', p.soil],
    ['fund lid', p.lid.lidUpcoming],
    ['brass', p.brass],
    ['stone past', p.stone.past],
    ['leaf', p.leaf],
    ...CATEGORY_ORDER.map((k) => [k, p.category[k]] as [string, string]),
  ];
  return (
    <div className={cn('grid grid-cols-2 gap-x-6 gap-y-1 rounded-sm border border-rule bg-background p-3 sm:grid-cols-3', theme === 'dark' && 'dark')}>
      {rows.map(([name, hex]) => {
        const t = faceTones(hex, theme);
        return (
          <div key={name} className="flex items-center gap-2">
            <span className="flex">
              {[t.top, t.left, t.right].map((c) => (
                <span key={c} className="h-5 w-5" style={{ background: c }} title={c} />
              ))}
            </span>
            <span className="type-ledger text-ink">{name}</span>
            <span className="type-overline text-ink-3">{`${t.left} ${t.right}`}</span>
          </div>
        );
      })}
    </div>
  );
}

function MotionDemo({ tier, allow3D }: { tier: IsoTier; allow3D: boolean }) {
  const [jarFill, setJarFill] = useState(0.7);
  const [stack, setStack] = useState(2);
  const [launchKey, setLaunchKey] = useState<number | null>(null);
  const motion: MotionState = useMemo(
    () => ({
      jarFill,
      stack,
      launchKey,
      onLanded: () => {
        setStack((n) => Math.min(n + 1, 10));
        setLaunchKey(null);
      },
    }),
    [jarFill, stack, launchKey],
  );
  const spend = () => {
    if (launchKey !== null || stack >= 10) return;
    setJarFill((f) => Math.max(0, f - 1 / 120));
    setLaunchKey(Date.now());
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={spend}
          className="type-label h-10 rounded-lg bg-fund px-4 text-on-fund shadow-hard outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Spend RM 20
        </button>
        <button
          type="button"
          onClick={() => {
            setStack(2);
            setJarFill(0.7);
          }}
          className="type-label h-10 rounded-lg border border-ink bg-leaf px-4 text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Reset
        </button>
      </div>
      <div className="flex flex-col gap-3 lg:flex-row">
        {allow3D ? (
          <KitFrame
            theme="light"
            board="motion"
            render="3d"
            tier={tier}
            bounds={MOTION_BOUNDS}
            points={MOTION_POINTS}
            labels={[]}
            heightClass="h-[260px] lg:h-[360px]"
            caption={`WebGL · light · ${tier}`}
            motion={motion}
          />
        ) : null}
        <KitFrame
          theme="light"
          board="motion"
          render="svg"
          tier={tier}
          bounds={MOTION_BOUNDS}
          points={MOTION_POINTS}
          labels={[]}
          heightClass="h-[260px] lg:h-[360px]"
          caption="SVG twin · light"
          motion={motion}
        />
      </div>
    </div>
  );
}

function KindSwitcher({ theme, tier, svgOnly }: { theme: ThemeName; tier: IsoTier; svgOnly: boolean }) {
  const [i, setI] = useState(0);
  const fixtures = stageFixtures();
  const { spec } = fixtures[i];
  return (
    <div className="flex flex-col gap-3">
      <Segmented<string>
        label="Kind"
        value={String(i)}
        onChange={(v) => setI(Number(v))}
        options={fixtures.map((f, k) => ({ value: String(k), label: f.spec.kind }))}
      />
      <div className="rounded-sm border border-rule bg-card p-3">
        <IsoStage spec={spec} height={{ base: 220, lg: 320 }} theme={theme} tier={tier} svgOnly={svgOnly} />
      </div>
    </div>
  );
}

export default function IsoKit() {
  const [theme, setTheme] = useState<ThemeName>(() => (readParam('theme') === 'dark' ? 'dark' : 'light'));
  const [tier, setTier] = useState<IsoTier>(() => (readParam('tier') === 'lite' ? 'lite' : 'high'));
  const [render, setRender] = useState<'both' | 'svg'>(() => (readParam('svg') === '1' ? 'svg' : 'both'));
  const only = readParam('section');
  const focus = readParam('focus') as CellId | null;
  const focusCells = useMemo(() => {
    const list = focus ? PRIMITIVE_CELLS.filter((c) => c.id === focus) : PRIMITIVE_CELLS;
    return list.length ? list : PRIMITIVE_CELLS;
  }, [focus]);
  const primPoints = useMemo(() => cellPoints(focusCells), [focusCells]);
  const primLabels = useMemo(() => focusCells.map(cellLabel), [focusCells]);
  const primIds = focus ? focusCells.map((c) => c.id) : undefined;
  const gate = useMemo(() => get3DGate(), []);
  const allow3D = gate.ok && render === 'both';
  const show = (s: string) => !only || only === s;

  const boardRow = (board: Board, bounds: Bounds, points: Vec3[], labels: SceneLabel[], heightClass: string, cells?: CellId[]) => (
    <div className="flex flex-col gap-6">
      {(['light', 'dark'] as ThemeName[]).map((t) => (
        <div key={t} className={cn('flex flex-col gap-3', focus && 'lg:flex-row')}>
          {allow3D ? (
            <KitFrame
              theme={t}
              board={board}
              render="3d"
              tier={tier}
              bounds={bounds}
              points={points}
              labels={labels}
              cells={cells}
              heightClass={heightClass}
              caption={`WebGL · ${t} · ${tier}`}
            />
          ) : null}
          <KitFrame
            theme={t}
            board={board}
            render="svg"
            tier={tier}
            bounds={bounds}
            points={points}
            labels={labels}
            cells={cells}
            heightClass={heightClass}
            caption={`SVG twin · ${t}`}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className={cn('min-h-screen bg-background text-foreground', theme === 'dark' && 'dark')}>
      <div className="mx-auto flex max-w-[1400px] flex-col gap-10 px-4 py-6 lg:px-6">
        <header className="flex flex-col gap-4">
          <div>
            <p className="type-overline text-ink-3">Dev · iso kit</p>
            <h1 className="type-display-3 text-ink">Primitive gallery</h1>
            <p className="type-body-s text-ink-2">
              {gate.ok ? `WebGL on, gate tier ${gate.tier}.` : `WebGL off (${'reason' in gate ? gate.reason : ''}). SVG twins only.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Segmented<ThemeName>
              label="Stage theme"
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
            <Segmented<IsoTier>
              label="Tier"
              value={tier}
              onChange={setTier}
              options={[
                { value: 'high', label: 'High' },
                { value: 'lite', label: 'Lite' },
              ]}
            />
            <Segmented<'both' | 'svg'>
              label="Render"
              value={render}
              onChange={setRender}
              options={[
                { value: 'both', label: '3D + SVG' },
                { value: 'svg', label: 'SVG only' },
              ]}
            />
          </div>
        </header>

        {show('primitives') ? (
          <Section title="Primitives" note="Every primitive in both themes, WebGL beside its SVG twin. Same projection, same face tones.">
            {boardRow('primitives', PRIMITIVE_BOUNDS, primPoints, primLabels, focus ? 'h-[420px] lg:h-[560px]' : 'h-[460px] lg:h-[880px]', primIds)}
          </Section>
        ) : null}

        {show('states') ? (
          <Section title="Render states" note="Sketch before the trip, ink on the road, chop once home.">
            {boardRow('states', STATE_BOUNDS, STATE_POINTS, STATE_LABELS, 'h-[260px] lg:h-[440px]')}
          </Section>
        ) : null}

        {show('motion') ? (
          <Section title="Motion" note="A coin leaves the jar for today's stone: 450ms parabola, one bounce, then the counts move. The frame counter stops when it lands.">
            <MotionDemo tier={tier} allow3D={allow3D} />
          </Section>
        ) : null}

        {show('tones') ? (
          <Section title="Face tones" note="Top, left (+Z) and right (+X) for each base colour.">
            <div className="flex flex-col gap-3 lg:flex-row">
              <ToneSwatches theme="light" />
              <ToneSwatches theme="dark" />
            </div>
          </Section>
        ) : null}

        {show('switch') || show('stages') ? (
          <Section title="One stage, many kinds" note="Trip tabs swap the scene in one stage: the canvas stays, the new twin shows until the new scene's first frame.">
            <KindSwitcher theme={theme} tier={tier} svgOnly={render === 'svg'} />
          </Section>
        ) : null}

        {show('stages') ? (
          <Section title="Stages" note="IsoStage per scene kind with real mapper fixtures: twin first, then the canvas crossfades in.">
            <div className="grid gap-8 lg:grid-cols-2">
              {stageFixtures().map(({ spec, height }) => (
                <div key={spec.kind} className="flex flex-col gap-1">
                  <p className="type-overline text-ink-3">{spec.kind}</p>
                  <div className="rounded-sm border border-rule bg-card p-3">
                    <IsoStage spec={spec} height={height} theme={theme} tier={tier} svgOnly={render === 'svg'} />
                  </div>
                </div>
              ))}
            </div>
          </Section>
        ) : null}
      </div>
    </div>
  );
}
