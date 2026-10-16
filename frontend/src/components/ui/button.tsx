import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// §5.3. Primary carries the hard shadow; pressing any button moves it 2px down-right (the shadow's
// direction) and drops the shadow, so it reads as pushed into the page. Focus ring comes from index.css.
const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-sans text-[15px] font-semibold leading-5 transition-[transform,box-shadow,background-color,color,border-color] duration-press ease-out active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:[stroke-width:1.75]",
  {
    variants: {
      variant: {
        default: "bg-fund text-on-fund shadow-hard hover:bg-fund/90",
        secondary: "border-[1.5px] border-ink bg-leaf text-ink hover:bg-sunken",
        // Kept for existing call sites: same as secondary.
        outline: "border-[1.5px] border-ink bg-leaf text-ink hover:bg-sunken",
        ghost: "text-ink decoration-1 underline-offset-[3px] hover:underline focus-visible:underline",
        // Always underlined so it reads as a link without hover; the rule darkens on hover/focus.
        link: "text-ink underline decoration-rule-strong decoration-1 underline-offset-[3px] active:translate-x-0 active:translate-y-0 hover:decoration-ink focus-visible:decoration-ink",
        destructive: "border-[1.5px] border-stamp bg-transparent text-stamp hover:bg-stamp-tint",
        // Solid stamp fill is only for the confirm action inside an AlertDialog.
        destructiveSolid: "bg-stamp text-on-stamp shadow-hard hover:bg-stamp/90",
        warning: "bg-warning text-warning-foreground shadow-hard hover:bg-warning/90",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-9 gap-1.5 px-3 text-sm [&_svg]:size-4",
        lg: "h-12 px-6 text-base",
        icon: "h-11 w-11",
      },
    },
    compoundVariants: [
      // Icon-only ghost buttons have no text to underline, so they get the hover surface instead.
      { variant: "ghost", size: "icon", class: "hover:bg-accent" },
      { variant: "link", size: ["default", "sm", "lg"], class: "h-auto px-0" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
