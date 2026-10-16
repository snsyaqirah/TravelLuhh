import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

// Every colour reads a CSS variable from src/index.css so the .dark class swaps the palette
// and opacity modifiers (bg-fund/90) keep working.
const v = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

const CATEGORY_KEYS = ["stay", "transport", "activities", "packages", "food", "shopping", "other"] as const;

export default {
  darkMode: ["class"],
  content: ["./index.html", "./dev/**/*.html", "./src/**/*.{ts,tsx}"],
  prefix: "",
  // Category colours are often picked at runtime (bg-cat-${key}); keep the small set compiled.
  safelist: [{ pattern: new RegExp(`^(bg|border|fill|stroke)-cat-(${CATEGORY_KEYS.join("|")})$`) }],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", lg: "1.5rem" },
      // 1120px content + 2 × 24px gutters
      screens: { content: "1168px" },
    },
    // Only the hard 2px shadow exists. Blurred shadows are not part of the system (§12.4).
    boxShadow: {
      hard: "var(--shadow-hard)",
      none: "none",
    },
    extend: {
      fontFamily: {
        sans: ['"Schibsted Grotesk"', "system-ui", "sans-serif"],
        display: ["Newsreader", "Georgia", "serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        border: v("border"),
        input: v("input"),
        ring: v("ring"),
        background: v("background"),
        foreground: v("foreground"),
        primary: { DEFAULT: v("primary"), foreground: v("primary-foreground") },
        secondary: { DEFAULT: v("secondary"), foreground: v("secondary-foreground") },
        destructive: { DEFAULT: v("destructive"), foreground: v("destructive-foreground") },
        success: { DEFAULT: v("success"), foreground: v("success-foreground") },
        warning: { DEFAULT: v("warning"), foreground: v("warning-foreground") },
        muted: { DEFAULT: v("muted"), foreground: v("muted-foreground") },
        accent: { DEFAULT: v("accent"), foreground: v("accent-foreground") },
        popover: { DEFAULT: v("popover"), foreground: v("popover-foreground") },
        card: { DEFAULT: v("card"), foreground: v("card-foreground") },
        sidebar: {
          DEFAULT: v("sidebar-background"),
          foreground: v("sidebar-foreground"),
          primary: v("sidebar-primary"),
          "primary-foreground": v("sidebar-primary-foreground"),
          accent: v("sidebar-accent"),
          "accent-foreground": v("sidebar-accent-foreground"),
          border: v("sidebar-border"),
          ring: v("sidebar-ring"),
          muted: v("sidebar-muted"),
        },

        paper: v("paper"),
        leaf: v("leaf"),
        raised: v("raised"),
        sunken: v("sunken"),
        stripe: v("stripe"),
        rule: v("rule"),
        "rule-strong": v("rule-strong"),
        field: v("field"),
        ink: { DEFAULT: v("ink"), 2: v("ink-2"), 3: v("ink-3") },
        fund: { DEFAULT: v("fund"), tint: v("fund-tint"), on: v("on-fund") },
        brass: { DEFAULT: v("brass"), ink: v("brass-ink") },
        stamp: { DEFAULT: v("stamp"), tint: v("stamp-tint"), on: v("on-stamp") },
        // Also as text-on-fund / text-on-stamp, which is how the spec writes them.
        "on-fund": v("on-fund"),
        "on-stamp": v("on-stamp"),
        shade: v("shade"),
        airmail: v("airmail"),
        cat: Object.fromEntries(CATEGORY_KEYS.map((k) => [k, v(`cat-${k}`)])),
      },
      borderRadius: {
        lg: "var(--radius)", // 6px: cards, buttons, sheets
        md: "calc(var(--radius) - 2px)", // 4px: menus, popovers
        sm: "calc(var(--radius) - 4px)", // 2px: inputs, chips
        // Banned sizes (§12.5) collapse to the card radius so stragglers can't round off. lint:look still flags them.
        xl: "var(--radius)",
        "2xl": "var(--radius)",
        "3xl": "var(--radius)",
      },
      transitionDuration: {
        press: "var(--dur-press)",
        micro: "var(--dur-micro)",
        route: "var(--dur-route)",
        ui: "var(--dur-ui)",
        object: "var(--dur-object)",
        act: "var(--dur-act)",
      },
      transitionTimingFunction: {
        out: "var(--ease-out)",
        drop: "var(--ease-drop)",
        stamp: "var(--ease-stamp)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        // New passbook row: printed top to bottom.
        "print-in": {
          from: { clipPath: "inset(0 0 100% 0)" },
          to: { clipPath: "inset(0)" },
        },
        // Uses the individual `scale` property so a stamp's own rotate transform is left alone.
        "stamp-in": {
          from: { scale: "1.12", opacity: "0" },
          to: { scale: "1", opacity: "0.85" },
        },
        // One-frame 2px nudge of the stamp's parent as it lands.
        "stamp-shake": {
          "0%, 99%": { translate: "2px 1px" },
          "100%": { translate: "0 0" },
        },
        flap: {
          from: { transform: "rotateX(90deg)" },
          to: { transform: "rotateX(0deg)" },
        },
        crossfade: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "caret-blink": {
          "0%, 70%, 100%": { opacity: "1" },
          "20%, 50%": { opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down var(--dur-ui) var(--ease-out)",
        "accordion-up": "accordion-up var(--dur-ui) var(--ease-out)",
        "print-in": "print-in 240ms var(--ease-out) both",
        "stamp-in": "stamp-in 180ms var(--ease-stamp) both",
        "stamp-shake": "stamp-shake 17ms steps(1) 170ms 1",
        flap: "flap var(--dur-micro) var(--ease-out) both",
        crossfade: "crossfade var(--dur-route) var(--ease-out) both",
        "caret-blink": "caret-blink 1.2s ease-out infinite",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
