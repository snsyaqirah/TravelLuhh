import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AppThemeProvider, THEME_STORAGE_KEY, ThemeToggle, useThemeName } from "@/components/theme/ThemeProvider";

function ThemeName() {
  return <output data-testid="name">{useThemeName()}</output>;
}

function setup() {
  return render(
    <AppThemeProvider>
      <ThemeToggle />
      <ThemeName />
    </AppThemeProvider>,
  );
}

afterEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
});

describe("ThemeToggle", () => {
  it("starts on Auto and resolves to light when the system is light", () => {
    setup();
    expect(screen.getByRole("radio", { name: "Auto" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("name")).toHaveTextContent("light");
  });

  it("switches to dark: class on <html>, saved under travelluhh_theme, hook follows", () => {
    setup();
    act(() => {
      fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    });
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(screen.getByTestId("name")).toHaveTextContent("dark");
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
  });

  it("moves the choice with arrow keys and keeps one tab stop", () => {
    setup();
    const light = screen.getByRole("radio", { name: "Light" });
    act(() => {
      fireEvent.click(light);
    });
    act(() => {
      fireEvent.keyDown(light, { key: "ArrowRight" });
    });
    const dark = screen.getByRole("radio", { name: "Dark" });
    expect(dark).toHaveAttribute("aria-checked", "true");
    expect(dark).toHaveFocus();
    const tabStops = screen.getAllByRole("radio").filter((r) => r.getAttribute("tabindex") === "0");
    expect(tabStops).toEqual([dark]);
  });
});
