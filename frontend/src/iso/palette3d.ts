// 3D-only palette (§7.5). Reads tokens.ts; scenes and specs speak in keys, this resolves them per theme.
import {
  categoryColors,
  fabricTones,
  tokens,
  type CategoryKey,
  type FabricKey,
  type ThemeName,
} from '@/design/tokens';
import type { LidColorKey } from '@/iso/specs';

export interface Palette3D {
  theme: ThemeName;
  /** Plinth top */
  ground: string;
  /** Plinth under-layer, shelf, stilts, signpost post */
  soil: string;
  /** Opaque hard shadow fill */
  shadow: string;
  /** Three coin tints; one InstancedMesh each */
  coins: readonly [string, string, string];
  lid: Record<LidColorKey, string>;
  stone: { past: string; today: string };
  /** Over-allowance rim, IOU line, budget-over line */
  over: string;
  suitcase: { shell: string; corners: string; straps: string };
  house: { body: string; stilts: string; door: string };
  roof: { under: string; over: string };
  /** Balang glass tint */
  glass: string;
  category: Record<CategoryKey, string>;
  fabric: Record<FabricKey, string>;
  ink: string;
  ink2: string;
  ink3: string;
  leaf: string;
  paper: string;
  shade: string;
  brass: string;
  fund: string;
  stamp: string;
  rule: string;
  ruleStrong: string;
  /** Edge line opacity on hero meshes (§7.4) */
  edgeOpacity: number;
  /** Glass silhouette line opacity */
  glassLineOpacity: number;
  glassBackOpacity: number;
  glassFrontOpacity: number;
}

function build(theme: ThemeName): Palette3D {
  const t = tokens[theme];
  const light = theme === 'light';
  return {
    theme,
    ground: light ? '#E4DCCB' : '#26302A',
    soil: light ? '#B89E7C' : '#3A332B',
    shadow: light ? '#C6BDAD' : '#1A221E',
    coins: light ? ['#D8A93B', '#E2B851', '#C99A2F'] : ['#E3B65A', '#EBC572', '#CFA048'],
    lid: { lidUpcoming: t.fund, lidOnTheRoad: t.brass, lidHome: t.ruleStrong },
    stone: { past: t.ruleStrong, today: t.brass },
    over: t.stamp,
    suitcase: light
      ? { shell: '#9A6B45', corners: t.brass, straps: '#1D2420' }
      : { shell: '#8A6040', corners: t.brass, straps: '#0E1311' },
    house: { body: t.leaf, stilts: light ? '#B89E7C' : '#3A332B', door: t.shade },
    roof: { under: t.fund, over: t.stamp },
    glass: light ? '#DCE8E2' : '#2B3A33',
    category: categoryColors[theme],
    fabric: fabricTones[theme],
    ink: t.ink,
    ink2: t.ink2,
    ink3: t.ink3,
    leaf: t.leaf,
    paper: t.paper,
    shade: t.shade,
    brass: t.brass,
    fund: t.fund,
    stamp: t.stamp,
    rule: t.rule,
    ruleStrong: t.ruleStrong,
    edgeOpacity: light ? 0.35 : 0.22,
    glassLineOpacity: light ? 0.45 : 0.3,
    glassBackOpacity: 0.35,
    glassFrontOpacity: 0.1,
  };
}

const palettes: Record<ThemeName, Palette3D> = { light: build('light'), dark: build('dark') };

export function palette3d(theme: ThemeName): Palette3D {
  return palettes[theme];
}

/** Flat colour keys a Spec may carry (never hex). Categories and fabrics may also be passed bare. */
export type ColorKey =
  | 'ground'
  | 'soil'
  | 'shadow'
  | 'coin0'
  | 'coin1'
  | 'coin2'
  | LidColorKey
  | 'stonePast'
  | 'stoneToday'
  | 'over'
  | 'suitcaseShell'
  | 'suitcaseCorners'
  | 'suitcaseStraps'
  | 'houseBody'
  | 'houseStilts'
  | 'houseDoor'
  | 'roofUnder'
  | 'roofOver'
  | 'glass'
  | 'ink'
  | 'ink2'
  | 'ink3'
  | 'leaf'
  | 'paper'
  | 'shade'
  | 'brass'
  | 'fund'
  | 'stamp'
  | 'rule'
  | 'ruleStrong'
  | `cat:${CategoryKey}`
  | `fabric:${FabricKey}`
  | CategoryKey
  | FabricKey;

/** Resolve a palette key to hex for a theme. Throws on an unknown key so a typo fails loudly in dev. */
export function colorOf(key: ColorKey, theme: ThemeName): string {
  const p = palettes[theme];
  if (key.startsWith('cat:')) return p.category[key.slice(4) as CategoryKey];
  if (key.startsWith('fabric:')) return p.fabric[key.slice(7) as FabricKey];
  if (key in p.category) return p.category[key as CategoryKey];
  if (key in p.fabric) return p.fabric[key as FabricKey];
  switch (key) {
    case 'coin0':
      return p.coins[0];
    case 'coin1':
      return p.coins[1];
    case 'coin2':
      return p.coins[2];
    case 'lidUpcoming':
    case 'lidOnTheRoad':
    case 'lidHome':
      return p.lid[key];
    case 'stonePast':
      return p.stone.past;
    case 'stoneToday':
      return p.stone.today;
    case 'suitcaseShell':
      return p.suitcase.shell;
    case 'suitcaseCorners':
      return p.suitcase.corners;
    case 'suitcaseStraps':
      return p.suitcase.straps;
    case 'houseBody':
      return p.house.body;
    case 'houseStilts':
      return p.house.stilts;
    case 'houseDoor':
      return p.house.door;
    case 'roofUnder':
      return p.roof.under;
    case 'roofOver':
      return p.roof.over;
    default: {
      const v = (p as unknown as Record<string, unknown>)[key];
      if (typeof v === 'string') return v;
      throw new Error(`Unknown palette key: ${key}`);
    }
  }
}
