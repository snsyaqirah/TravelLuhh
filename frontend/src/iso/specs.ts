// Frozen scene contracts. Mappers (src/iso/mappers) produce these; IsoStage renders them with either the
// lazy three.js scene or the SVG twin. Positions are world units (1 unit = 1 tile, snapped to 0.25).
// Colours are *keys* resolved per theme by palette3d, never hex.

export type Vec3 = [number, number, number];

export type SceneKind = 'shelf' | 'tripPlot' | 'counter' | 'suitcase' | 'kampung';

export type LabelTone = 'ink' | 'fund' | 'stamp' | 'muted';

export interface SceneLabel {
  id: string;
  at: Vec3;
  text: string;
  sub?: string;
  tone?: LabelTone;
  anchor?: 'above' | 'below' | 'left' | 'right';
  /**
   * Display rank, lower first (default 0; ties keep array order). Labels beyond the visible cap
   * (`SceneSpecBase.maxLabels`, default 4) only show on focus/hover of the target with the same id.
   */
  priority?: number;
  /**
   * Only shown while the target with the same id is hovered or focused. Never counts toward the visible cap,
   * so a chip that doesn't fit can ride along as a reveal without four chips showing first.
   */
  focusOnly?: boolean;
}

export interface SceneTarget {
  id: string;
  at: Vec3;
  sizePx?: number;
  ariaLabel: string;
  href?: string;
  action?: { type: string; payload?: unknown };
}

export interface SceneSpecBase {
  kind: SceneKind;
  bounds: { min: Vec3; max: Vec3 };
  labels: SceneLabel[];
  targets: SceneTarget[];
  /** Visible one-line text under the scene; also the slot's aria-label. */
  summary: string;
  /** e.g. "1 coin = RM 20" */
  unitChip?: string;
  /**
   * How many labels (by priority, focusOnly ones excluded) are always visible; the rest show on focus/hover
   * of their target. Default 4 (§7.8). Raise it only when the mapper has already sized labels so they cannot
   * collide (the desktop Shelf shows 5). IsoStage's `maxLabels` prop overrides it.
   */
  maxLabels?: number;
  /** Panning scenes only (fit 'height'): which end is in view first. Default 'center'. */
  panStart?: PanStart;
}

export type PanStart = 'start' | 'center' | 'end';

export type RenderState = 'sketch' | 'ink' | 'chop';
export type LidState = 'closed' | 'tilted' | 'off';
export type LidColorKey = 'lidUpcoming' | 'lidOnTheRoad' | 'lidHome';
