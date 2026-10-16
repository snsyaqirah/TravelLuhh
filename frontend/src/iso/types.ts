// Shared iso types that are not part of the frozen scene contract (specs.ts).
// Pure types only: importing this file never pulls three.js into a bundle.
import type { ComponentType } from 'react';
import type { ThemeName } from '@/design/tokens';
import type { SceneKind, SceneSpecBase, Vec3 } from '@/iso/specs';

export type { ThemeName };

/** Render tier picked by the gate (§7.8). `lite` = DPR 1, no edges, coin capacity 60, no ledger texture. */
export type IsoTier = 'high' | 'lite';

/** TripPlot only: live on the trip page, draft in the Create flow, demo on Landing. */
export type StageMode = 'live' | 'draft' | 'demo';

/** How the camera frames `spec.bounds`. `height` fits the height and lets the scene pan sideways (Kampung). */
export type StageFit = 'contain' | 'height';

/** What the camera looks at and how far it is zoomed. Shared by WebGL, the SVG twin, labels and targets. */
export interface IsoView {
  /** Pixels per world unit (the orthographic camera's `zoom`). */
  zoom: number;
  /** World point the camera looks at; it sits at the centre of the slot. */
  center: Vec3;
}

/** Props every 3D scene component receives from the registry. */
export interface IsoSceneProps<S extends SceneSpecBase = SceneSpecBase> {
  spec: S;
  theme: ThemeName;
  tier: IsoTier;
  mode?: StageMode;
  draftStep?: number;
  /** True → render the final pose once and run no tweens. */
  reducedMotion: boolean;
}

/**
 * Props every SVG twin receives. A twin returns SVG *content* (a `<g>`) in projected world units;
 * IsoStage wraps it in an `<IsoSvgFrame>` whose viewBox matches the WebGL camera exactly.
 * Standalone twins (MiniBalangSvg on the Trips list) wrap themselves in `<IsoSvgFrame bounds>`.
 */
export interface IsoSvgTwinProps<S extends SceneSpecBase = SceneSpecBase> {
  spec: S;
  theme: ThemeName;
  mode?: StageMode;
  draftStep?: number;
}

export type IsoSceneComponent<S extends SceneSpecBase = SceneSpecBase> = ComponentType<IsoSceneProps<S>>;
export type IsoSvgTwinComponent<S extends SceneSpecBase = SceneSpecBase> = ComponentType<IsoSvgTwinProps<S>>;

export type SvgTwinRegistry = Record<SceneKind, IsoSvgTwinComponent>;

/** A footprint on the ground plane as [x, z] pairs (local units). */
export type Footprint = ReadonlyArray<readonly [number, number]>;

/** Day stone state (§2.2). `future` stones draw as Ghosts. */
export type StoneState = 'past' | 'today' | 'future';
