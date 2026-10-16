import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

// Tooltip brings its own provider when none is above it, so the app root doesn't need one (a root provider
// would pull floating-ui into the entry chunk). An explicit TooltipProvider still wins and groups delays.
const InsideProvider = React.createContext(false);

const TooltipProvider = ({ children, ...props }: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>) => (
  <TooltipPrimitive.Provider {...props}>
    <InsideProvider.Provider value={true}>{children}</InsideProvider.Provider>
  </TooltipPrimitive.Provider>
);
TooltipProvider.displayName = "TooltipProvider";

const Tooltip = (props: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>) => {
  const provided = React.useContext(InsideProvider);
  if (provided) return <TooltipPrimitive.Root {...props} />;
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root {...props} />
    </TooltipPrimitive.Provider>
  );
};
Tooltip.displayName = "Tooltip";

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-sm border border-rule-strong bg-popover px-2.5 py-1.5 font-sans text-sm leading-5 text-popover-foreground shadow-hard duration-micro animate-in fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
      className,
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
