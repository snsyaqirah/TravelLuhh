import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

// 20px square, 2px radius, 1.5px field border; checked is a fund box with an on-fund tick (§5.3).
// The ::after extends the hit area to 44px without changing layout.
const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer relative h-5 w-5 shrink-0 rounded-sm border-[1.5px] border-field bg-leaf text-on-fund transition-colors duration-micro ease-out after:absolute after:-inset-3 after:content-[''] hover:border-ink disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-fund data-[state=indeterminate]:border-fund data-[state=checked]:bg-fund data-[state=indeterminate]:bg-fund",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
      {props.checked === "indeterminate" ? (
        <Minus className="h-3.5 w-3.5" strokeWidth={3} />
      ) : (
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
