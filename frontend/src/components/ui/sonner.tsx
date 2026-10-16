import type * as React from "react";
import { Toaster as Sonner, toast } from "sonner";

import { useThemeName } from "@/components/theme/ThemeProvider";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Sonner's own palette is swapped for the passbook one through its CSS variables; the classes below
// add the hard shadow and the 3px status rule. Titles turn into a mono overline when a description
// follows (see index.css). On phones toasts sit above the 64px BottomBar.
const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useThemeName();

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      mobileOffset={{ bottom: "calc(76px + env(safe-area-inset-bottom))" }}
      style={
        {
          "--normal-bg": "hsl(var(--card))",
          "--normal-border": "hsl(var(--rule-strong))",
          "--normal-text": "hsl(var(--ink))",
          "--border-radius": "calc(var(--radius) - 2px)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "group toast gap-3 font-sans group-[.toaster]:border-l-[3px] group-[.toaster]:border-l-fund group-[.toaster]:bg-card group-[.toaster]:text-ink group-[.toaster]:shadow-hard",
          title: "text-[15px] font-medium leading-5",
          description: "group-[.toast]:type-body-s group-[.toast]:text-ink-2",
          actionButton:
            "group-[.toast]:h-8 group-[.toast]:rounded-md group-[.toast]:bg-fund group-[.toast]:px-3 group-[.toast]:font-semibold group-[.toast]:text-on-fund",
          cancelButton:
            "group-[.toast]:h-8 group-[.toast]:rounded-md group-[.toast]:bg-sunken group-[.toast]:px-3 group-[.toast]:text-ink-2",
          closeButton: "group-[.toast]:border-rule-strong group-[.toast]:bg-card group-[.toast]:text-ink-2",
          error: "group-[.toaster]:border-l-stamp [&_[data-icon]]:text-stamp",
          warning: "group-[.toaster]:border-l-brass [&_[data-icon]]:text-brass-ink",
          success: "[&_[data-icon]]:text-fund",
          info: "group-[.toaster]:border-l-airmail [&_[data-icon]]:text-airmail",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
