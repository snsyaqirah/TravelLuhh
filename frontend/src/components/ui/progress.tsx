import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

// Flat-ended 10px bar on fund-tint (the CoinRail track). For money, prefer the CoinRail motif.
const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, max = 100, ...props }, ref) => {
  // Clamp so over-budget values (e.g. 120%) neither overflow the bar nor trip Radix's range check.
  const clamped = value == null ? value : Math.min(max, Math.max(0, value));
  const pct = clamped == null ? 0 : (clamped / max) * 100;
  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn("relative h-2.5 w-full overflow-hidden bg-fund-tint", className)}
      value={clamped}
      max={max}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full flex-1 bg-fund transition-transform duration-object ease-out"
        style={{ transform: `translateX(-${100 - pct}%)` }}
      />
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
