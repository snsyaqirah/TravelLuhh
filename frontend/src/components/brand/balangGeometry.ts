// Geometry for the BalangMark: a Raya cookie jar (balang) with a coin slot in its lid, i.e. a tabung.
// Drawn in the shared isometric projection (DESIGN-SPEC §7.1) so the logo sits in the same world as the scenes:
//   x' = (x − z)·0.70711,  y' = (x + z)·0.40825 − y·0.8165   (screen units, y down)
// A horizontal circle of radius r therefore projects to an ellipse with rx = r, ry = r·0.57735.
// Everything is computed once at module load into a 20×20 viewBox.

type P3 = readonly [number, number, number];

const isoProject = ([x, y, z]: P3): [number, number] => [(x - z) * 0.70711, (x + z) * 0.40825 - y * 0.8165];

const ELLIPSE_RY = 0.57735;

// Jar dimensions in world units (body radius = 1).
const BODY_R = 1;
const WALL_TOP = 1.4; // straight wall ends, shoulder begins
const LID_R = 0.72;
const LID_BOTTOM = 1.74;
const LID_TOP = 2.04;
const SLOT_HALF = 0.4; // coin slot runs along world X on the lid top
const RIDGE_Y = 0.6; // one moulded ridge round the body, so it reads as round glass, not a box

const VIEW = 20;
const STROKE = 1.5;
const PAD = STROKE / 2 + 0.5;

// Fit the jar's projected bounds into the viewBox.
const top = -LID_TOP * 0.8165 - LID_R * ELLIPSE_RY;
const bottom = BODY_R * ELLIPSE_RY;
const scale = (VIEW - PAD * 2) / (bottom - top);

const fmt = (n: number) => Number(n.toFixed(2)).toString();

/** World point → "x y" in viewBox coordinates. */
function pt(p: P3): string {
  const [sx, sy] = isoProject(p);
  return `${fmt(VIEW / 2 + sx * scale)} ${fmt(PAD + (sy - top) * scale)}`;
}

/** Point on the silhouette edge (screen-left or -right) of the horizontal circle radius r at height y. */
function edge(side: -1 | 1, r: number, y: number): string {
  // Screen x = ±r lies at world (±r/√2, y, ∓r/√2).
  const h = (side * r) / Math.SQRT2;
  return pt([h, y, -h]);
}

/** Front (lower) half of the horizontal circle at height y, drawn left → right. */
function frontArc(r: number, y: number): string {
  return `M${edge(-1, r, y)} A${fmt(r * scale)} ${fmt(r * ELLIPSE_RY * scale)} 0 0 0 ${edge(1, r, y)}`;
}

const rx = (r: number) => fmt(r * scale);
const ry = (r: number) => fmt(r * ELLIPSE_RY * scale);

/** Jar silhouette: bottom front arc, walls, shoulder, lid walls, lid back arc. */
export const BALANG_OUTLINE = [
  `M${edge(-1, BODY_R, 0)}`,
  `A${rx(BODY_R)} ${ry(BODY_R)} 0 0 0 ${edge(1, BODY_R, 0)}`,
  `L${edge(1, BODY_R, WALL_TOP)}`,
  `C${edge(1, BODY_R, WALL_TOP + 0.2)} ${edge(1, LID_R, LID_BOTTOM - 0.14)} ${edge(1, LID_R, LID_BOTTOM)}`,
  `L${edge(1, LID_R, LID_TOP)}`,
  `A${rx(LID_R)} ${ry(LID_R)} 0 0 0 ${edge(-1, LID_R, LID_TOP)}`,
  `L${edge(-1, LID_R, LID_BOTTOM)}`,
  `C${edge(-1, LID_R, LID_BOTTOM - 0.14)} ${edge(-1, BODY_R, WALL_TOP + 0.2)} ${edge(-1, BODY_R, WALL_TOP)}`,
  "Z",
].join(" ");

/** Seam where the lid meets the jar, plus the body ridge. */
export const BALANG_SEAMS = `${frontArc(LID_R, LID_BOTTOM)} ${frontArc(BODY_R, RIDGE_Y)}`;

/** Lid top face (full ellipse) as a path, so it can take the accent fill. */
export const BALANG_LID_TOP = (() => {
  const l = edge(-1, LID_R, LID_TOP);
  const r = edge(1, LID_R, LID_TOP);
  return `M${l} A${rx(LID_R)} ${ry(LID_R)} 0 0 0 ${r} A${rx(LID_R)} ${ry(LID_R)} 0 0 0 ${l} Z`;
})();

/** Coin slot: a short cut along world X across the lid top. */
export const BALANG_SLOT = `M${pt([-SLOT_HALF, LID_TOP, 0])} L${pt([SLOT_HALF, LID_TOP, 0])}`;

export const BALANG_VIEWBOX = `0 0 ${VIEW} ${VIEW}`;
export const BALANG_STROKE = STROKE;
