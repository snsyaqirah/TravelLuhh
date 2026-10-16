import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { tokens, type ThemeName } from "@/design/tokens";

export const THEME_STORAGE_KEY = "travelluhh_theme";

/**
 * Root theme provider (DESIGN-SPEC §3.5). Toggles `.light` / `.dark` on <html>.
 * index.html applies the saved class before first paint; this takes over once React mounts.
 */
export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey={THEME_STORAGE_KEY}
      disableTransitionOnChange
    >
      <ThemeColorSync />
      {children}
    </NextThemesProvider>
  );
}

function readDomTheme(): ThemeName {
  if (typeof document === "undefined") return "light";
  const root = document.documentElement.classList;
  if (root.contains("dark")) return "dark";
  if (root.contains("light")) return "light";
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

/**
 * The resolved theme, always 'light' or 'dark'. Before next-themes has resolved "system"
 * it falls back to the class index.html already put on <html>, so the first render is right.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useThemeName(): ThemeName {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "light" || resolvedTheme === "dark" ? resolvedTheme : readDomTheme();
}

// Keeps the browser chrome (mobile status bar) on the paper colour of the chosen theme,
// including when the choice differs from the OS preference the <meta media> tags assume.
function ThemeColorSync() {
  const theme = useThemeName();
  React.useEffect(() => {
    const paper = tokens[theme].paper;
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", paper));
  }, [theme]);
  return null;
}

type ThemeChoice = "light" | "dark" | "system";

const CHOICES: { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Auto" },
];

export interface ThemeToggleProps {
  /** 'paper' on app surfaces, 'sidebar' on the desktop rail (passbook cover). */
  tone?: "paper" | "sidebar";
  /** 'md' is 44px tall for touch; 'sm' (32px) is for the dense desktop rail. */
  size?: "sm" | "md";
  className?: string;
}

/** Segmented "Light · Dark · Auto" control (§6.3). A radio group: arrow keys move the choice. */
export function ThemeToggle({ tone = "paper", size = "md", className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const current: ThemeChoice = theme === "light" || theme === "dark" ? theme : "system";
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + CHOICES.length) % CHOICES.length;
    setTheme(CHOICES[next].value);
    refs.current[next]?.focus();
  };

  const sidebar = tone === "sidebar";

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        "inline-grid grid-cols-3 rounded-md border p-0.5",
        sidebar ? "border-sidebar-border" : "border-rule-strong bg-leaf",
        className,
      )}
    >
      {CHOICES.map((choice, i) => {
        const active = choice.value === current;
        return (
          <button
            key={choice.value}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => setTheme(choice.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "type-label rounded-sm px-3 transition-colors duration-micro ease-out",
              size === "md" ? "h-10 min-w-[4.25rem]" : "h-7 min-w-[3.5rem]",
              sidebar
                ? active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-muted hover:text-sidebar-foreground"
                : active
                  ? "bg-ink text-paper"
                  : "text-ink-2 hover:bg-accent hover:text-ink",
            )}
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}
