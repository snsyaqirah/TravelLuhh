import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

// Flat-ended 10px track like the CoinRail; the thumb is a small pressable block with the hard shadow.
const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex h-11 w-full touch-none select-none items-center", className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-2.5 w-full grow overflow-hidden bg-sunken">
      <SliderPrimitive.Range className="absolute h-full bg-fund" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-6 w-4 rounded-sm border-[1.5px] border-ink bg-leaf shadow-hard transition-[box-shadow,transform] duration-press ease-out active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
