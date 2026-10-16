// Design tokens — the single source of truth for colour.
// index.css mirrors these as HSL triplets (Tailwind's hsl(var(--x)) pattern); tokens.test.ts keeps them in sync.
// The 3D layer (src/iso) reads hex from here, never from CSS.

export type ThemeName = 'light' | 'dark';

export const light = {
  paper: '#F3EEE3',
  leaf: '#FBF8F1',
  raised: '#FFFDF8',
  sunken: '#E9E2D3',
  stripe: '#F6F1E6',
  rule: '#D6CCB8',
  ruleStrong: '#B9AD95',
  field: '#827760',
  ink: '#1D2420',
  ink2: '#4E5852',
  ink3: '#62685F',
  fund: '#17583F',
  fundTint: '#DCEBE2',
  onFund: '#FBF8F1',
  brass: '#D8A93B',
  brassInk: '#8A6414',
  stamp: '#B03A2A',
  stampTint: '#F4DDD5',
  onStamp: '#FBF8F1',
  shade: '#3B2F26',
  airmail: '#2C6FA6',
} as const;

export const dark = {
  paper: '#121815',
  leaf: '#1A221E',
  raised: '#232D28',
  sunken: '#0E1311',
  stripe: '#161D1A',
  rule: '#34403A',
  ruleStrong: '#4A5850',
  field: '#6E7B72',
  ink: '#EFE8D8',
  ink2: '#B9B4A4',
  ink3: '#959286',
  fund: '#63C29A',
  fundTint: '#1C3329',
  onFund: '#0E1A14',
  brass: '#E3B65A',
  brassInk: '#E3B65A',
  stamp: '#EF6B55',
  stampTint: '#3A1D17',
  onStamp: '#0E1311',
  shade: '#050807',
  airmail: '#6FA3D6',
} as const;

export type ColorTokens = { [K in keyof typeof light]: string };

export const tokens: Record<ThemeName, ColorTokens> = { light, dark };

// Expense categories — fixed display order everywhere (legends, skyline, tables, glyph grid).
export const CATEGORY_ORDER = [
  'accommodation',
  'transportation',
  'activities',
  'bundle',
  'food',
  'shopping',
  'other',
] as const;

export type CategoryKey = (typeof CATEGORY_ORDER)[number];

export const categoryColors: Record<ThemeName, Record<CategoryKey, string>> = {
  light: {
    accommodation: '#A65A2E',
    transportation: '#2C6FA6',
    activities: '#3F8A4C',
    bundle: '#7E2E3E',
    food: '#AD7A18',
    shopping: '#C2457A',
    other: '#6F6B60',
  },
  dark: {
    accommodation: '#C27045',
    transportation: '#4F8FC9',
    activities: '#56A062',
    bundle: '#A84E60',
    food: '#C9962E',
    shopping: '#D2638F',
    other: '#A29E90',
  },
};

// Packing fabric tones (3D suitcase only).
export const FABRIC_KEYS = ['khaki', 'sage', 'clay', 'denim', 'linen', 'passport'] as const;
export type FabricKey = (typeof FABRIC_KEYS)[number];

export const fabricTones: Record<ThemeName, Record<FabricKey, string>> = {
  light: { khaki: '#C9B79C', sage: '#8FA3A0', clay: '#B98E7E', denim: '#6F7F96', linen: '#D9CDB4', passport: '#7E2E3E' },
  dark: { khaki: '#928672', sage: '#687875', clay: '#87685D', denim: '#515E6E', linen: '#9E9684', passport: '#A84E60' },
};

// Motion tokens (ms) — mirrored as CSS custom properties in index.css.
export const motion = {
  micro: 120,
  ui: 200,
  object: 450,
  act: 900,
  press: 80, // press translate(2px,2px) + shadow drop
  route: 150, // route crossfade
  printIn: 240, // new passbook row
  stampIn: 180,
} as const;

// Easing curves (§10). CSS strings mirror --ease-*; the tuples suit framer-motion's `ease`.
export const easing = {
  out: 'cubic-bezier(.2,.8,.2,1)',
  drop: 'cubic-bezier(.5,0,.75,0)', // follow with one 6% bounce
  stamp: 'cubic-bezier(.3,1.5,.5,1)',
} as const;

export const easingCurve = {
  out: [0.2, 0.8, 0.2, 1],
  drop: [0.5, 0, 0.75, 0],
  stamp: [0.3, 1.5, 0.5, 1],
} as const satisfies Record<keyof typeof easing, readonly [number, number, number, number]>;

// Desktop rail, the "passbook cover" (§3.1 / §3.2 sidebar tables).
export interface SidebarTokens {
  background: string;
  foreground: string;
  primary: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
  border: string;
  ring: string;
  muted: string;
}

export const sidebar: Record<ThemeName, SidebarTokens> = {
  light: {
    background: '#17583F',
    foreground: '#FBF8F1',
    primary: '#D8A93B',
    primaryForeground: '#1D2420',
    accent: '#21664B',
    accentForeground: '#FBF8F1',
    border: '#2E7258',
    ring: '#D8A93B',
    muted: '#BFD3C8',
  },
  dark: {
    background: '#0E1311',
    foreground: '#EFE8D8',
    primary: '#E3B65A',
    primaryForeground: '#0E1311',
    accent: '#1A221E',
    accentForeground: '#EFE8D8',
    border: '#34403A',
    ring: '#E3B65A',
    muted: '#959286',
  },
};

// CSS / Tailwind key for each category: --cat-stay, bg-cat-stay, ...
export const CATEGORY_CSS_KEY: Record<CategoryKey, string> = {
  accommodation: 'stay',
  transportation: 'transport',
  activities: 'activities',
  bundle: 'packages',
  food: 'food',
  shopping: 'shopping',
  other: 'other',
};

/** `hsl(var(--cat-stay))` etc. Use for inline styles and SVG fills; theme-aware through CSS. */
export function categoryColorVar(key: CategoryKey, alpha?: number): string {
  const v = `var(--cat-${CATEGORY_CSS_KEY[key]})`;
  return alpha === undefined ? `hsl(${v})` : `hsl(${v} / ${alpha})`;
}

/**
 * Every colour custom property index.css must define, with its hex, per theme.
 * shadcn names alias the passbook tokens (e.g. --card = --leaf). tokens.test.ts checks index.css against this.
 */
export function cssColorVars(theme: ThemeName): Record<string, string> {
  const t = tokens[theme];
  const sb = sidebar[theme];
  const cat = categoryColors[theme];
  const isDark = theme === 'dark';
  const vars: Record<string, string> = {
    background: t.paper,
    foreground: t.ink,
    card: t.leaf,
    'card-foreground': t.ink,
    popover: t.raised,
    'popover-foreground': t.ink,
    primary: t.fund,
    'primary-foreground': t.onFund,
    // Light: secondary = sunken well. Dark: one step up (raised), so it reads as a surface on paper.
    secondary: isDark ? t.raised : t.sunken,
    'secondary-foreground': t.ink,
    muted: t.sunken,
    'muted-foreground': t.ink2,
    // Hover/focus surface only. Never brass.
    accent: isDark ? t.rule : t.sunken,
    'accent-foreground': t.ink,
    destructive: t.stamp,
    'destructive-foreground': t.onStamp,
    success: t.fund,
    'success-foreground': t.onFund,
    warning: t.brass,
    'warning-foreground': isDark ? t.sunken : t.ink,
    border: t.rule,
    input: t.field,
    ring: t.fund,
    paper: t.paper,
    leaf: t.leaf,
    raised: t.raised,
    sunken: t.sunken,
    stripe: t.stripe,
    rule: t.rule,
    'rule-strong': t.ruleStrong,
    field: t.field,
    ink: t.ink,
    'ink-2': t.ink2,
    'ink-3': t.ink3,
    fund: t.fund,
    'fund-tint': t.fundTint,
    'on-fund': t.onFund,
    brass: t.brass,
    'brass-ink': t.brassInk,
    stamp: t.stamp,
    'stamp-tint': t.stampTint,
    'on-stamp': t.onStamp,
    shade: t.shade,
    airmail: t.airmail,
    'sidebar-background': sb.background,
    'sidebar-foreground': sb.foreground,
    'sidebar-primary': sb.primary,
    'sidebar-primary-foreground': sb.primaryForeground,
    'sidebar-accent': sb.accent,
    'sidebar-accent-foreground': sb.accentForeground,
    'sidebar-border': sb.border,
    'sidebar-ring': sb.ring,
    'sidebar-muted': sb.muted,
  };
  for (const key of CATEGORY_ORDER) vars[`cat-${CATEGORY_CSS_KEY[key]}`] = cat[key];
  return vars;
}
