// Pure placement rules for scene overlays (labels and DOM targets), shared by SceneLabels and tests.
import { toScreen } from '@/iso/projection';
import type { SceneLabel, SceneTarget } from '@/iso/specs';
import type { IsoView } from '@/iso/types';

export const MAX_VISIBLE_LABELS = 4;
export const MIN_TARGET_SPACING = 32;
export const MIN_TARGET_SIZE = 32;

/** Lower `priority` first (default 0); ties keep array order. The first four are always shown. */
export function rankLabels(labels: readonly SceneLabel[]): SceneLabel[] {
  return labels
    .map((l, i) => ({ l, i }))
    .sort((a, b) => (a.l.priority ?? 0) - (b.l.priority ?? 0) || a.i - b.i)
    .map((x) => x.l);
}

/** The visible cap for a stage: the page's override, else the spec's, else 4 (§7.8). Never below 0. */
export function labelCap(override?: number, specMax?: number): number {
  const n = override ?? specMax ?? MAX_VISIBLE_LABELS;
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : MAX_VISIBLE_LABELS;
}

export interface LabelVisibility {
  label: SceneLabel;
  /** Shown without interaction. Otherwise only while the target with the same id is hovered/focused. */
  always: boolean;
}

/**
 * Which labels show without interaction: the first `max` by priority, skipping `focusOnly` labels (they never
 * take a slot). Ranked labels come first, then the focusOnly ones in array order.
 */
export function labelVisibility(labels: readonly SceneLabel[], max = MAX_VISIBLE_LABELS): LabelVisibility[] {
  const ranked = rankLabels(labels.filter((l) => !l.focusOnly)).map((label, rank) => ({ label, always: rank < max }));
  const reveal = labels.filter((l) => l.focusOnly).map((label) => ({ label, always: false }));
  return [...ranked, ...reveal];
}

/** Drop focusOnly labels that no target can reveal (their target was thinned out for spacing). */
export function withRevealTargets(labels: readonly SceneLabel[], targets: readonly SceneTarget[]): SceneLabel[] {
  const ids = new Set(targets.map((t) => t.id));
  return labels.filter((l) => !l.focusOnly || ids.has(l.id));
}

/** Labels to draw right now, given the hovered/focused target id. */
export function visibleLabels(labels: readonly SceneLabel[], max = MAX_VISIBLE_LABELS, activeId?: string | null): SceneLabel[] {
  return labelVisibility(labels, max)
    .filter((v) => v.always || (activeId != null && v.label.id === activeId))
    .map((v) => v.label);
}

export interface PlacedTarget {
  target: SceneTarget;
  x: number;
  y: number;
  size: number;
}

/**
 * Project targets and drop any whose nearest neighbour is closer than `minSpacing` px, or that fall outside
 * the slot. The same action is always offered in 2D, so dropping one never strands a feature.
 */
export function placeTargets(
  targets: readonly SceneTarget[],
  view: IsoView,
  size: { w: number; h: number },
  minSpacing = MIN_TARGET_SPACING,
): PlacedTarget[] {
  const all = targets.map((target) => {
    const [x, y] = toScreen(target.at, view.zoom, view.center, size.w, size.h);
    return { target, x, y, size: Math.max(MIN_TARGET_SIZE, target.sizePx ?? 44) };
  });
  return all.filter((a, i) => {
    if (a.x < 0 || a.y < 0 || a.x > size.w || a.y > size.h) return false;
    return all.every((b, j) => i === j || Math.hypot(a.x - b.x, a.y - b.y) >= minSpacing);
  });
}

