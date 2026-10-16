import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

// A ledger month: Newsreader caption, mono weekday overlines and mono numerals. Selection is a fund
// block, a range runs through fund-tint, and today carries a brass rule (today is brass everywhere).
function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col gap-4 sm:flex-row sm:gap-6",
        month: "space-y-3",
        caption: "relative flex h-10 items-center justify-center",
        caption_label: "font-display text-lg font-medium leading-6 text-ink",
        nav: "flex items-center gap-1",
        nav_button: cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-9 w-9 text-ink-2 hover:bg-accent"),
        nav_button_previous: "absolute left-0",
        nav_button_next: "absolute right-0",
        table: "w-full border-collapse",
        head_row: "flex border-b border-rule",
        head_cell: "type-overline flex h-8 w-10 items-center justify-center font-normal text-ink-3",
        row: "mt-1 flex w-full",
        cell: "relative h-10 w-10 p-0 text-center focus-within:relative focus-within:z-20 [&:has([aria-selected].day-outside)]:bg-fund-tint/50 [&:has([aria-selected].day-range-middle)]:bg-fund-tint",
        day: "inline-flex h-10 w-10 items-center justify-center rounded-sm font-mono text-sm tabular-nums text-ink transition-colors duration-micro hover:bg-accent aria-selected:opacity-100",
        day_range_start: "day-range-start",
        day_range_end: "day-range-end",
        day_selected: "bg-fund font-medium text-on-fund hover:bg-fund hover:text-on-fund focus:bg-fund focus:text-on-fund",
        day_today: "font-semibold shadow-[inset_0_-3px_0_0_hsl(var(--brass))]",
        day_outside: "day-outside text-ink-3 opacity-70 aria-selected:text-ink-2",
        day_disabled: "text-ink-3 line-through opacity-50 hover:bg-transparent",
        day_range_middle: "day-range-middle aria-selected:bg-transparent aria-selected:font-normal aria-selected:text-fund",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: () => <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />,
        IconRight: () => <ChevronRight className="h-5 w-5" strokeWidth={1.75} />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
