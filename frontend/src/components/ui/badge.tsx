import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// A printed chip: 2px radius, Plex Mono caps. Never a pill.
const badgeVariants = cva(
  "inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-sm border px-1.5 font-mono text-[11px] font-medium uppercase leading-none tracking-[0.06em] [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-transparent bg-fund-tint text-fund",
        secondary: "border-transparent bg-sunken text-ink-2",
        destructive: "border-transparent bg-stamp-tint text-stamp",
        // The ISO-code chip (JP, MY): ink rule, ink text.
        outline: "border-ink bg-transparent text-ink",
        solid: "border-transparent bg-fund text-on-fund",
        warning: "border-transparent bg-warning text-warning-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
