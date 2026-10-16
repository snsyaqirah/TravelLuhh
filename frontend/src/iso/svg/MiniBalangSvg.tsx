/**
 * A single balang drawn flat, for places that never get WebGL (§8): the Trips list ticket stub, the Me page.
 * Same projection, face tones and fill rule as the 3D jar (coins = round(capacity × fill), lid colour by phase),
 * because it *is* the SVG twin's SvgBalang inside a standalone IsoSvgFrame.
 */
import type { ThemeName } from '@/design/tokens';
import { useThemeName } from '@/components/theme/ThemeProvider';
import type { Phase } from '@/lib/phase';
import type { Bounds } from '@/iso/projection';
import { JAR_MAX_R, JAR_REF_HEIGHT, LID } from '@/iso/shapes';
import type { LidColorKey, LidState } from '@/iso/specs';
import { IsoSvgFrame } from '@/iso/svg/IsoSvg';
import { SvgBalang } from '@/iso/svg/primitives';

export interface MiniBalangSvgProps {
  /** inJar / target, 0..1 (FundState.fill). */
  fill: number;
  /** Lid colour: fund before, brass on the road, rule-strong at home. */
  phase?: Phase;
  /** Over budget: no coins and the lid lies beside the jar. */
  over?: boolean;
  /** Overrides the lid pose (default closed, or tilted when over). */
  lid?: LidState;
  /** 3 coin slots for a shared pot. */
  slots?: 1 | 3;
  /** CSS px. Default 44 × 56 (the mobile stub); the desktop stub uses 56 × 72. */
  width?: number;
  height?: number;
  /** Defaults to the app's resolved theme. */
  theme?: ThemeName;
  /** Accessible name; without it the jar is decorative. */
  title?: string;
  className?: string;
}

const LID_BY_PHASE: Record<Phase, LidColorKey> = {
  upcoming: 'lidUpcoming',
  onTheRoad: 'lidOnTheRoad',
  home: 'lidHome',
};

// A horizontal circle of radius r spans exactly ±r on screen when its box is ±r/√2 in x and z, so this box
// frames the jar body tightly instead of wasting the corners of the full ±r square.
const R = JAR_MAX_R * Math.SQRT1_2;
const CLOSED: Bounds = { min: [-R, 0, -R], max: [R, JAR_REF_HEIGHT + LID.h, R] };
// Tilted lid leans on the jar's +Z side (screen front-left) and reaches about 1.66 out.
const TILTED: Bounds = { min: [-R, 0, -R], max: [R + 0.45, JAR_REF_HEIGHT, 1.75] };

export function MiniBalangSvg({
  fill,
  phase = 'upcoming',
  over = false,
  lid,
  slots = 1,
  width = 44,
  height = 56,
  theme: themeProp,
  title,
  className,
}: MiniBalangSvgProps) {
  const appTheme = useThemeName();
  const theme = themeProp ?? appTheme;
  const pose: LidState = lid ?? (over ? 'tilted' : 'closed');
  const f = over ? 0 : Math.min(Math.max(Number.isFinite(fill) ? fill : 0, 0), 1);
  return (
    <IsoSvgFrame
      bounds={pose === 'tilted' ? TILTED : CLOSED}
      theme={theme}
      size={{ w: width, h: height }}
      title={title}
      className={className}
    >
      <SvgBalang at={[0, 0, 0]} fill={f} lid={pose} lidColor={LID_BY_PHASE[phase]} slots={slots} shadow={false} />
    </IsoSvgFrame>
  );
}

export default MiniBalangSvg;
