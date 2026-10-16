import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// "On" is printed in ink (inverted), the same selected state as the theme toggle and segmented controls.
const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md font-sans text-sm font-medium text-ink-2 transition-colors duration-micro ease-out hover:bg-accent hover:text-ink disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-ink data-[state=on]:text-paper [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-rule-strong bg-leaf",
      },
      size: {
        default: "h-11 min-w-11 px-3 md:h-10 md:min-w-10",
        sm: "h-9 min-w-9 px-2.5",
        lg: "h-12 min-w-12 px-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root ref={ref} className={cn(toggleVariants({ variant, size, className }))} {...props} />
));

Toggle.displayName = TogglePrimitive.Root.displayName;

export { Toggle, toggleVariants };
