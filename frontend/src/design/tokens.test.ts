// index.css mirrors tokens.ts as HSL triplets. This keeps the two from drifting: every colour variable in
// :root / .dark must convert back to the tokens.ts hex within 1 step per RGB channel, and neither side may
// have a colour the other lacks.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { cssColorVars, tokens, type ThemeName } from "@/design/tokens";

// Read from disk: Vitest stubs CSS imports (even ?raw) to empty strings.
const css = readFileSync(resolve(__dirname, "../index.css"), "utf8");

function block(selector: ":root" | ".dark"): string {
  const escaped = selector.replace(".", "\\.");
  const match = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (!match) throw new Error(`index.css has no ${selector} block`);
  return match[1];
}

/** Every `--name: H S% L%;` declaration in a block (other custom properties are skipped). */
function triplets(body: string): Map<string, [number, number, number]> {
  const out = new Map<string, [number, number, number]>();
  const re = /--([a-z0-9-]+):\s*(-?[\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*;/g;
  for (let m = re.exec(body); m; m = re.exec(body)) {
    out.set(m[1], [Number(m[2]), Number(m[3]), Number(m[4])]);
  }
  return out;
}

function hslToRgb([h, s, l]: [number, number, number]): [number, number, number] {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((x) => Math.round(x * 255)) as [number, number, number];
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const THEMES: [ThemeName, ":root" | ".dark"][] = [
  ["light", ":root"],
  ["dark", ".dark"],
];

describe.each(THEMES)("index.css %s theme", (theme, selector) => {
  const declared = triplets(block(selector));
  const expected = cssColorVars(theme);

  it("declares exactly the colour variables tokens.ts knows about", () => {
    expect([...declared.keys()].sort()).toEqual(Object.keys(expected).sort());
  });

  it.each(Object.entries(expected))("--%s matches %s within 1 RGB step", (name, hex) => {
    const triplet = declared.get(name);
    expect(triplet, `--${name} missing from ${selector}`).toBeDefined();
    const got = hslToRgb(triplet!);
    const want = hexToRgb(hex);
    const delta = Math.max(...got.map((c, i) => Math.abs(c - want[i])));
    expect(delta, `--${name}: css rgb(${got}) vs ${hex}`).toBeLessThanOrEqual(1);
  });

  it("casts the hard shadow in the shade colour", () => {
    const shadow = /--shadow-hard:\s*2px 2px 0 0 hsl\(([\d.]+) ([\d.]+)% ([\d.]+)%/.exec(block(selector));
    expect(shadow).not.toBeNull();
    const rgb = hslToRgb([Number(shadow![1]), Number(shadow![2]), Number(shadow![3])]);
    const want = hexToRgb(tokens[theme].shade);
    expect(Math.max(...rgb.map((c, i) => Math.abs(c - want[i])))).toBeLessThanOrEqual(1);
  });
});

describe("hsl conversion", () => {
  it("round-trips a known spec value", () => {
    // §3.1: --fund #17583F = 156.9 58.6% 21.8%
    expect(hslToRgb([156.9, 58.6, 21.8])).toEqual(hexToRgb("#17583F"));
  });
});
